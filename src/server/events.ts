import pg from 'pg';
import type { Db } from './db/pool.js';

/** One row of the append-only `events` table, as sent to clients. */
export interface EventRow {
  seq: string;               // bigint as string
  at: string;
  actor_kind: string;
  actor_id: string;
  on_behalf_of: string | null;
  type: string;
  task_id: string | null;
  target: string | null;
  version_id: string | null;
  prev_state: string | null;
  new_state: string | null;
  reason: string | null;
  data: Record<string, unknown>;
  is_demo: boolean;
}

export const EVENT_COLS = 'seq::text AS seq, at, actor_kind, actor_id, on_behalf_of, type, task_id, target, version_id, prev_state, new_state, reason, data, is_demo';

/** Event types that only concern the signed-in person and are not shown in the shared team stream. */
const PRIVATE_TYPES = new Set(['auth.login', 'auth.logout']);
export const isStreamable = (e: Pick<EventRow, 'type'>) => !PRIVATE_TYPES.has(e.type);

/**
 * Fans committed events out to live subscribers.
 * Postgres announces each committed event seq (trigger in 002); the hub fetches that exact row,
 * so events that commit out of seq order are still delivered. Clients must de-duplicate by seq
 * because replay after a reconnect deliberately overlaps a little.
 */
export class EventHub {
  private subs = new Set<(e: EventRow) => void>();
  private listener: pg.Client | null = null;
  private stopped = false;
  private retryTimer: NodeJS.Timeout | null = null;
  connected = false;

  constructor(private db: Db, private url: string) {}

  async start() {
    this.stopped = false;
    await this.connect();
  }

  private async connect() {
    const client = new pg.Client({ connectionString: this.url });
    client.on('notification', (n) => { if (n.channel === 'candy_events' && n.payload) void this.deliver(n.payload); });
    client.on('error', () => this.reconnectSoon());
    client.on('end', () => this.reconnectSoon());
    try {
      await client.connect();
      await client.query('LISTEN candy_events');
      this.listener = client;
      this.connected = true;
    } catch {
      client.removeAllListeners();
      await client.end().catch(() => {});
      this.reconnectSoon();
    }
  }

  private reconnectSoon() {
    this.connected = false;
    if (this.stopped || this.retryTimer) return;
    const old = this.listener; this.listener = null;
    old?.removeAllListeners(); void old?.end().catch(() => {});
    this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.connect(); }, 2000);
  }

  private async deliver(seq: string) {
    if (!/^\d+$/.test(seq)) return;
    const row = (await this.db.query(`SELECT ${EVENT_COLS} FROM events WHERE seq=$1`, [seq]).catch(() => ({ rows: [] }))).rows[0] as EventRow | undefined;
    if (!row || !isStreamable(row)) return;
    for (const fn of this.subs) { try { fn(row); } catch { /* one bad subscriber must not stop others */ } }
  }

  subscribe(fn: (e: EventRow) => void) {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  }

  get subscriberCount() { return this.subs.size; }

  /** Events after `afterSeq` for replay, with a small overlap window for out-of-order commits. */
  async replay(afterSeq: number, limit = 1000): Promise<EventRow[]> {
    const from = Math.max(0, afterSeq - 50);
    const r = await this.db.query(`SELECT ${EVENT_COLS} FROM events WHERE seq > $1 ORDER BY seq LIMIT $2`, [from, limit]);
    return (r.rows as EventRow[]).filter(isStreamable);
  }

  async stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const l = this.listener; this.listener = null; this.connected = false;
    l?.removeAllListeners();
    await l?.end().catch(() => {});
    this.subs.clear();
  }
}

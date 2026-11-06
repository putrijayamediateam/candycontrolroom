import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from './db/pool.js';
import { tx } from './db/pool.js';
import { PolicyError } from './core/workflow.js';
import {
  listDecisions, markPickedUp, markRead, monitorFeed, postOwnerMessage, postStaffMessage, recordDecision, threadMessages, threadSummaries, workerInbox,
} from './core/chat.js';

const Thread = z.object({ thread: z.string().regex(/^[a-z][a-z0-9_-]{0,40}$/) });
const StaffId = z.string().regex(/^[a-z][a-z0-9_-]{0,40}$/);

/** How recently a Claude session must have checked in to count as "answering now". */
export const WORKER_ONLINE_MS = 3 * 60_000;

export async function workerStatus(db: Db) {
  const r = (await db.query(`SELECT value FROM app_settings WHERE key='worker_last_seen'`)).rows[0];
  const last = r ? new Date(r.value as string) : null;
  return { online: !!last && Date.now() - last.getTime() < WORKER_ONLINE_MS, last_seen: last };
}

export function registerChatRoutes(app: FastifyInstance, opts: { db: Db; workerToken?: string | null }) {
  const { db } = opts;
  const tokenHash = opts.workerToken ? createHash('sha256').update(opts.workerToken).digest() : null;

  const requireOwner = (req: FastifyRequest) => {
    if (req.user?.role !== 'owner') throw new PolicyError('forbidden', 'Only AIN (owner) can do this');
  };

  // ---------- AIN's side (session cookie) ----------
  app.get('/api/chat/threads', async () => {
    const c = await db.connect();
    try { return { threads: await threadSummaries(c), worker: await workerStatus(db) }; } finally { c.release(); }
  });

  app.get('/api/chat/:thread', async (req) => {
    const { thread } = Thread.parse(req.params);
    const q = z.object({ before: z.string().datetime({ offset: true }).optional() }).parse(req.query);
    const c = await db.connect();
    try { return { thread, messages: await threadMessages(c, thread, q.before), worker: await workerStatus(db) }; } finally { c.release(); }
  });

  app.post('/api/chat/:thread', async (req) => {
    requireOwner(req);
    const { thread } = Thread.parse(req.params);
    const b = z.object({ body: z.string().trim().min(1).max(10_000), routeTo: StaffId.nullable().optional() }).strict().parse(req.body);
    const m = await tx(db, (c) => postOwnerMessage(c, req.user!, { thread, body: b.body, routeTo: b.routeTo }));
    return { message: m };
  });

  app.post('/api/chat/:thread/read', async (req) => {
    requireOwner(req);
    const { thread } = Thread.parse(req.params);
    await tx(db, (c) => markRead(c, thread));
    return { ok: true };
  });

  app.get('/api/chat-monitor', async () => {
    const c = await db.connect();
    try { return { messages: await monitorFeed(c) }; } finally { c.release(); }
  });

  app.get('/api/decisions', async () => {
    const c = await db.connect();
    try { return { decisions: await listDecisions(c) }; } finally { c.release(); }
  });

  app.post('/api/decisions', async (req) => {
    requireOwner(req);
    const b = z.object({ body: z.string().trim().min(1).max(5000), messageId: z.uuid().optional(), decidedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict().parse(req.body);
    return { decision: await tx(db, (c) => recordDecision(c, req.user!.id, b)) };
  });

  // ---------- Worker side (a running Claude session, bearer token) ----------
  // Scope: read waiting messages and context, write chat messages as staff. Nothing else:
  // no approvals, no delegation, no publishing, no settings.
  app.addHook('preHandler', async (req, reply) => {
    if (!(req.routeOptions.url ?? '').startsWith('/api/worker/')) return;
    if (!tokenHash) return reply.code(503).send({ error: 'worker_disabled', message: 'WORKER_TOKEN is not set on the server' });
    const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''));
    const given = m ? createHash('sha256').update(m[1]).digest() : null;
    if (!given || !timingSafeEqual(given, tokenHash)) return reply.code(401).send({ error: 'unauthenticated', message: 'Worker token required' });
    await db.query(`INSERT INTO app_settings(key,value) VALUES ('worker_last_seen', to_jsonb(now())) ON CONFLICT (key) DO UPDATE SET value=to_jsonb(now())`);
  });

  app.get('/api/worker/inbox', async () => {
    const c = await db.connect();
    try { return await workerInbox(c); } finally { c.release(); }
  });

  app.post('/api/worker/heartbeat', async () => ({ ok: true }));

  app.post('/api/worker/pickup', async (req) => {
    const b = z.object({ ids: z.array(z.uuid()).max(200) }).parse(req.body);
    return { picked_up: await tx(db, (c) => markPickedUp(c, b.ids)) };
  });

  app.post('/api/worker/messages', async (req) => {
    const b = z.object({
      asStaff: StaffId, thread: StaffId, body: z.string().trim().min(1).max(10_000),
      replyTo: z.uuid().optional(), kind: z.enum(['reply', 'relay', 'message', 'note']).optional(), locale: z.enum(['en', 'ms']).optional(),
    }).strict().parse(req.body);
    const m = await tx(db, async (c) => {
      const out = await postStaffMessage(c, b);
      // Honest tool evidence: this staff action really ran in a Claude session.
      await c.query(
        `INSERT INTO tool_jobs (staff_id, tool, evidence, status, step, heartbeat_at, finished_at) VALUES ($1,'Claude Code session','verified','succeeded',$2, now(), now())`,
        [b.asStaff, b.kind === 'relay' ? `Passed an order to ${b.thread}` : `Wrote in ${b.thread === 'candy' ? 'CANDY' : b.thread}'s chat`]);
      return out;
    });
    return { message: m };
  });
}

/**
 * Stored state and live events → what the 3D office shows. Pure functions only.
 *
 * Honesty rules (BRIEF §8, DECISIONS): every pose comes from a stored record or a committed
 * event. Nobody is shown working, walking or talking unless a record or event says so.
 * After a refresh everyone is rebuilt from stored state at their own desk.
 */

export interface StaffRecord {
  id: string; display_name: string; role_title: string; department: string; colour: string;
  status: string; paused: boolean; open_questions?: number; open_tasks?: number; sort_order?: number;
  avatar?: Record<string, unknown> | null;
}
export interface TaskRecord {
  id: string; ref: string; title: string; stage: string; side_state: string | null; blocker: string | null;
  owner_staff: string | null; updated_at?: string; is_demo?: boolean;
}
export interface ThreadRecord { id: string; waiting: number; unread: number }
export interface EventRecord {
  seq: string; type: string; actor_kind: string; actor_id: string; task_id: string | null;
  target: string | null; new_state: string | null; is_demo?: boolean;
}

export type Activity = 'idle' | 'working' | 'paused';
export type Marker = 'waiting' | 'blocked' | 'unread';

export interface PersonState {
  id: string;
  activity: Activity;
  markers: Marker[];
  /** The task this person is most recently on (newest open task they own), if any. */
  task: TaskRecord | null;
  blocker: string | null;
}

/** Stages where the work is finished; such tasks are not "current". */
export const DONE_STAGES = new Set(['published', 'performance_review', 'released_verified']);
/** Stored staff statuses that mean someone is actively doing work (written by staff execution, not by the office). */
export const WORKING_STATUSES = new Set(['planning', 'drafting', 'designing', 'editing', 'coding', 'testing', 'reviewing', 'preparing_release', 'handoff']);
const WAITING_STATUSES = new Set(['asking_ain', 'waiting_approval', 'recording_awaited']);

/**
 * Builds everyone's resting state from stored records only.
 * - `working` only when the stored staff status says so (set by staff execution, which is not connected yet).
 * - waiting marker: open questions to AIN or chat messages waiting for an answer.
 * - blocked marker: an open task they own has a side state (blocked / needs information …).
 */
export function deriveOffice(staff: StaffRecord[], tasks: TaskRecord[], threads: ThreadRecord[]): Record<string, PersonState> {
  const out: Record<string, PersonState> = {};
  const waiting = new Map(threads.map((t) => [t.id, t]));
  for (const s of staff) {
    const mine = tasks
      .filter((t) => t.owner_staff === s.id && !DONE_STAGES.has(t.stage))
      .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
    const blockedTask = mine.find((t) => t.side_state);
    const markers: Marker[] = [];
    const th = waiting.get(s.id);
    if ((s.open_questions ?? 0) > 0 || (th?.waiting ?? 0) > 0 || WAITING_STATUSES.has(s.status)) markers.push('waiting');
    if (blockedTask || s.status === 'blocked') markers.push('blocked');
    if ((th?.unread ?? 0) > 0) markers.push('unread');
    out[s.id] = {
      id: s.id,
      activity: s.paused ? 'paused' : WORKING_STATUSES.has(s.status) ? 'working' : 'idle',
      markers,
      task: blockedTask ?? mine[0] ?? null,
      blocker: blockedTask?.blocker ?? blockedTask?.side_state ?? null,
    };
  }
  return out;
}

/** One-off animations triggered by a committed event. Durations are seconds. */
export type OfficeAction =
  | { kind: 'goto_desk'; staff: string; work: boolean }
  | { kind: 'visit_review'; staff: string; stay: number }
  | { kind: 'handoff'; from: string; to: string; stay: number }
  | { kind: 'gesture'; staff: string; gesture: 'talk' | 'complete' | 'waiting' | 'blocked'; duration: number };

export interface MapContext {
  /** Task id → owning staff id, from the stored task list. */
  taskOwner: (taskId: string) => string | null | undefined;
  /** Known staff and whether they are paused. */
  staff: Record<string, { paused: boolean }>;
}

const APPROVED = new Set(['approval.approved']);

/** Maps one committed event to office actions. Unknown or unrelated events map to nothing. */
export function eventToActions(e: EventRecord, ctx: MapContext): OfficeAction[] {
  const known = (id: string | null | undefined): id is string => !!id && id in ctx.staff;
  const active = (id: string | null | undefined): id is string => known(id) && !ctx.staff[id].paused;
  const staffActor = e.actor_kind === 'staff' || e.actor_kind === 'candy_delegated' ? e.actor_id : null;
  const owner = e.task_id ? ctx.taskOwner(e.task_id) : null;
  const out: OfficeAction[] = [];

  switch (e.type) {
    case 'task.stage_changed': {
      if (e.new_state && DONE_STAGES.has(e.new_state)) {
        if (active(owner)) out.push({ kind: 'gesture', staff: owner, gesture: 'complete', duration: 2.5 });
      } else if (active(owner)) {
        out.push({ kind: 'goto_desk', staff: owner, work: true });
      }
      break;
    }
    case 'review.submitted': {
      const who = active(staffActor) ? staffActor : active(owner) ? owner : null;
      if (who) out.push({ kind: 'visit_review', staff: who, stay: 6 });
      break;
    }
    case 'review.candy_completed': {
      if (active('candy')) out.push({ kind: 'visit_review', staff: 'candy', stay: 6 });
      break;
    }
    case 'question.asked': {
      const who = active(staffActor) ? staffActor : active(owner) ? owner : null;
      if (who) out.push({ kind: 'gesture', staff: who, gesture: 'waiting', duration: 2 });
      break;
    }
    case 'task.blocked': {
      if (active(owner)) out.push({ kind: 'gesture', staff: owner, gesture: 'blocked', duration: 2 });
      break;
    }
    case 'chat.order_relayed': {
      const to = e.target;
      if (active('candy') && active(to) && to !== 'candy') out.push({ kind: 'handoff', from: 'candy', to, stay: 4 });
      break;
    }
    case 'chat.staff_replied': {
      if (active(staffActor)) out.push({ kind: 'gesture', staff: staffActor, gesture: 'talk', duration: 2.5 });
      break;
    }
    default: {
      if (APPROVED.has(e.type) && active(owner)) out.push({ kind: 'gesture', staff: owner, gesture: 'complete', duration: 2.5 });
    }
  }
  return out;
}

/** Events newer than `lastSeq`, oldest first (the live feed is newest first). */
export function newEvents<T extends { seq: string }>(recent: T[], lastSeq: string | null): T[] {
  const last = lastSeq === null ? null : BigInt(lastSeq);
  return recent.filter((e) => last === null || BigInt(e.seq) > last).sort((a, b) => (BigInt(a.seq) < BigInt(b.seq) ? -1 : 1));
}

export function maxSeq(recent: { seq: string }[]): string | null {
  let m: bigint | null = null;
  for (const e of recent) { const v = BigInt(e.seq); if (m === null || v > m) m = v; }
  return m === null ? null : String(m);
}

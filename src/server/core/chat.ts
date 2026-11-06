import type { Tx } from '../db/pool.js';
import { myDate } from '../../shared/time.js';
import { PolicyError, emit } from './workflow.js';

export const HEAD = 'candy';
const MSG_COLS = `m.id, m.staff_id AS thread, m.author_kind, m.author_id, m.kind, m.body, m.reply_to, m.route_to, m.delivery,
  m.read_by_owner_at, m.locale, m.task_id, m.created_at, m.is_demo`;

async function requireThread(c: Tx, thread: string) {
  const s = (await c.query(`SELECT id, display_name, paused FROM staff WHERE id=$1`, [thread])).rows[0];
  if (!s) throw new PolicyError('not_found', 'No such chat');
  return s;
}

/**
 * AIN writes in a chat. In CANDY's head chat she can ask CANDY to pass an order to a staff member (routeTo).
 * Her message waits until a Claude session picks it up; nothing pretends to answer instantly.
 */
export async function postOwnerMessage(c: Tx, user: { id: string; interface_locale: string }, input: { thread: string; body: string; routeTo?: string | null }) {
  await requireThread(c, input.thread);
  if (input.routeTo) {
    if (input.thread !== HEAD) throw new PolicyError('invalid_input', 'Orders are passed on through CANDY\'s head chat');
    if (input.routeTo === HEAD) throw new PolicyError('invalid_input', 'Choose a staff member to pass the order to');
    await requireThread(c, input.routeTo);
  }
  const r = await c.query(
    `INSERT INTO messages (staff_id, author_kind, author_id, kind, body, route_to, delivery, locale, read_by_owner_at)
     VALUES ($1,'human',$2,$3,$4,$5,'waiting',$6, now()) RETURNING id`,
    [input.thread, user.id, input.routeTo ? 'order' : 'message', input.body, input.routeTo ?? null, user.interface_locale]);
  const id = r.rows[0].id;
  await emit(c, { kind: 'human', userId: user.id }, 'chat.message_sent', { target: input.thread, data: { message_id: id, route_to: input.routeTo ?? null } });
  return (await c.query(`SELECT ${MSG_COLS} FROM messages m WHERE m.id=$1`, [id])).rows[0];
}

/**
 * A staff member writes (only via the worker, i.e. a running Claude session).
 * Allowed: in their own chat; CANDY anywhere (she leads and relays); anyone reporting up into CANDY's head chat.
 */
export async function postStaffMessage(c: Tx, input: { asStaff: string; thread: string; body: string; replyTo?: string | null; kind?: 'reply' | 'relay' | 'message' | 'note'; locale?: string }) {
  const author = await requireThread(c, input.asStaff);
  await requireThread(c, input.thread);
  if (!(input.asStaff === input.thread || input.asStaff === HEAD || input.thread === HEAD))
    throw new PolicyError('forbidden', `${input.asStaff} cannot write in ${input.thread}'s chat`);
  if (author.paused) throw new PolicyError('task_paused', `${author.display_name} is paused by AIN`);
  const kind = input.kind ?? (input.replyTo ? 'reply' : 'message');
  if (kind === 'relay' && input.asStaff !== HEAD) throw new PolicyError('forbidden', 'Only CANDY relays orders');
  if (input.replyTo) {
    const orig = (await c.query(`SELECT id, author_kind FROM messages WHERE id=$1 FOR UPDATE`, [input.replyTo])).rows[0];
    if (!orig) throw new PolicyError('not_found', 'The message being answered does not exist');
  }
  const r = await c.query(
    `INSERT INTO messages (staff_id, author_kind, author_id, kind, body, reply_to, locale) VALUES ($1,'staff',$2,$3,$4,$5,$6) RETURNING id`,
    [input.thread, input.asStaff, kind, input.body, input.replyTo ?? null, input.locale ?? 'en']);
  if (input.replyTo) await c.query(`UPDATE messages SET delivery='answered' WHERE id=$1 AND author_kind='human'`, [input.replyTo]);
  await emit(c, { kind: 'staff', staffId: input.asStaff }, kind === 'relay' ? 'chat.order_relayed' : 'chat.staff_replied',
    { target: input.thread, data: { message_id: r.rows[0].id, reply_to: input.replyTo ?? null } });
  return (await c.query(`SELECT ${MSG_COLS} FROM messages m WHERE m.id=$1`, [r.rows[0].id])).rows[0];
}

export async function markPickedUp(c: Tx, ids: string[]) {
  if (!ids.length) return 0;
  const r = await c.query(`UPDATE messages SET delivery='picked_up' WHERE id = ANY($1::uuid[]) AND delivery='waiting' RETURNING id, staff_id`, [ids]);
  for (const m of r.rows) await emit(c, { kind: 'system' }, 'chat.picked_up', { target: m.staff_id, data: { message_id: m.id } });
  return r.rowCount ?? 0;
}

export async function threadMessages(c: Tx, thread: string, before?: string, limit = 100) {
  const r = await c.query(
    `SELECT ${MSG_COLS} FROM messages m WHERE m.staff_id=$1 AND ($2::timestamptz IS NULL OR m.created_at < $2) ORDER BY m.created_at DESC LIMIT $3`,
    [thread, before ?? null, limit]);
  return r.rows.reverse();
}

export async function markRead(c: Tx, thread: string) {
  await c.query(`UPDATE messages SET read_by_owner_at=now() WHERE staff_id=$1 AND author_kind<>'human' AND read_by_owner_at IS NULL`, [thread]);
}

/** One row per chat (CANDY first) with last message, unread replies and waiting messages. */
export async function threadSummaries(c: Tx) {
  return (await c.query(
    `SELECT s.id, s.display_name, s.role_title, s.department, s.colour, s.status, s.paused, s.reports_to, s.sort_order,
            (SELECT count(*)::int FROM messages m WHERE m.staff_id=s.id AND m.author_kind<>'human' AND m.read_by_owner_at IS NULL) AS unread,
            (SELECT count(*)::int FROM messages m WHERE m.staff_id=s.id AND m.delivery IN ('waiting','picked_up')) AS waiting,
            (SELECT json_build_object('body', left(m.body, 140), 'author_kind', m.author_kind, 'author_id', m.author_id, 'created_at', m.created_at)
               FROM messages m WHERE m.staff_id=s.id ORDER BY m.created_at DESC LIMIT 1) AS last
       FROM staff s ORDER BY s.sort_order`)).rows;
}

/** CANDY sees every sub-chat: latest messages across all staff chats. */
export async function monitorFeed(c: Tx, limit = 80) {
  return (await c.query(
    `SELECT ${MSG_COLS}, s.display_name AS thread_name FROM messages m JOIN staff s ON s.id=m.staff_id
      WHERE m.staff_id <> $1 ORDER BY m.created_at DESC LIMIT $2`, [HEAD, limit])).rows;
}

/** Everything a Claude session needs to answer waiting messages in role, with honest context. */
export async function workerInbox(c: Tx) {
  const pending = (await c.query(
    `SELECT ${MSG_COLS}, s.display_name AS thread_name, s.role_title AS thread_role, rs.display_name AS route_to_name
       FROM messages m JOIN staff s ON s.id=m.staff_id LEFT JOIN staff rs ON rs.id=m.route_to
      WHERE m.delivery IN ('waiting','picked_up') ORDER BY m.created_at`)).rows;
  const threads = [...new Set(pending.flatMap((m) => [m.thread, m.route_to].filter(Boolean)))];
  const context: Record<string, unknown> = {};
  for (const t of threads) {
    const s = (await c.query(`SELECT id, display_name, role_title, department, reports_to, deliverables, allowed_actions, prohibited_actions, paused, onboarding FROM staff WHERE id=$1`, [t])).rows[0];
    const instr = (await c.query(`SELECT version, body FROM staff_instructions WHERE staff_id=$1 ORDER BY version DESC LIMIT 1`, [t])).rows[0] ?? null;
    const files = (await c.query(`SELECT original_name, kind, category, note FROM training_files WHERE staff_id=$1 AND removed_at IS NULL ORDER BY created_at DESC LIMIT 30`, [t])).rows;
    const recent = await threadMessages(c, t, undefined, 20);
    context[t] = { staff: s, current_instructions: instr, training_files: files, recent_messages: recent };
  }
  const owner = (await c.query(`SELECT display_name, interface_locale, content_locale FROM users WHERE role='owner' ORDER BY created_at LIMIT 1`)).rows[0] ?? null;
  return { owner, pending, context, today: myDate() };
}

// ---------- Decisions log ----------
export async function listDecisions(c: Tx) {
  return (await c.query(`SELECT d.*, u.display_name AS recorded_by_name FROM decisions d LEFT JOIN users u ON u.id=d.recorded_by ORDER BY d.decided_on DESC, d.created_at DESC`)).rows;
}

export async function recordDecision(c: Tx, userId: string, input: { body: string; messageId?: string | null; decidedOn?: string }) {
  if (input.messageId) {
    const m = (await c.query(`SELECT author_kind FROM messages WHERE id=$1`, [input.messageId])).rows[0];
    if (!m) throw new PolicyError('not_found', 'Message not found');
  }
  const r = await c.query(
    `INSERT INTO decisions (decided_on, body, source, message_id, recorded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.decidedOn ?? myDate(), input.body, input.messageId ? 'head chat' : 'Control Room', input.messageId ?? null, userId]);
  await emit(c, { kind: 'human', userId }, 'decision.recorded', { target: r.rows[0].id, data: { body: input.body.slice(0, 200) } });
  return r.rows[0];
}

/** Imports the decisions table from docs/DECISIONS.md once, so the head chat starts with AIN's existing decisions. */
export async function importDecisionsDoc(c: Tx, markdown: string) {
  const n = (await c.query(`SELECT count(*)::int AS n FROM decisions`)).rows[0].n;
  if (n > 0) return 0;
  let added = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    await c.query(`INSERT INTO decisions (decided_on, body, source) VALUES ($1,$2,'docs/DECISIONS.md')`, [m[1], m[2]]);
    added++;
  }
  return added;
}

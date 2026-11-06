import type { Tx } from '../db/pool.js';
import { PolicyError, emit, type Actor } from './workflow.js';

/** Brief/train one staff member, a department, or the whole team. Creates a new instruction version each time. */
export async function briefStaff(c: Tx, userId: string, target: { staffId?: string; department?: string; all?: boolean }, body: string, changeNote?: string) {
  const ids = target.staffId ? [target.staffId]
    : (await c.query(`SELECT id FROM staff WHERE ($1::text IS NULL OR department=$1) AND ($2 OR $1 IS NOT NULL)`, [target.department ?? null, !!target.all])).rows.map((r) => r.id);
  if (!ids.length) throw new PolicyError('no_target', 'Choose a staff member, department, or the whole team');
  const out = [];
  for (const id of ids) {
    const v = await c.query(`SELECT coalesce(max(version),0)+1 AS n FROM staff_instructions WHERE staff_id=$1`, [id]);
    const r = await c.query(
      `INSERT INTO staff_instructions (staff_id, version, body, author_user, change_note) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, v.rows[0].n, body, userId, changeNote ?? null]);
    await c.query(`UPDATE staff SET onboarding='learning', updated_at=now() WHERE id=$1 AND onboarding='not_briefed'`, [id]);
    await emit(c, { kind: 'human', userId }, 'staff.briefed', { target: id, data: { version: v.rows[0].n } });
    out.push(r.rows[0]);
  }
  return out;
}

export async function currentInstructions(c: Tx, staffId: string) {
  return (await c.query(`SELECT * FROM staff_instructions WHERE staff_id=$1 ORDER BY version DESC`, [staffId])).rows;
}

/** Staff asks AIN a question; the task pauses at Needs Information until answered. */
export async function askQuestion(c: Tx, staffId: string, taskId: string, q: { question: string; why: string; recommended?: string }) {
  const t = (await c.query(`SELECT stage FROM tasks WHERE id=$1 FOR UPDATE`, [taskId])).rows[0];
  const r = await c.query(
    `INSERT INTO questions (task_id, staff_id, question, why_it_matters, recommended_assumption, resume_stage) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [taskId, staffId, q.question, q.why, q.recommended ?? null, t.stage]);
  await c.query(`UPDATE tasks SET side_state='needs_information', blocker=$2 WHERE id=$1`, [taskId, `Question from ${staffId}: ${q.question}`]);
  await emit(c, { kind: 'staff', staffId }, 'question.asked', { taskId, target: r.rows[0].id });
  return r.rows[0];
}

/** CANDY's digest: open questions grouped by task. */
export async function questionDigest(c: Tx) {
  const rows = (await c.query(
    `SELECT q.*, t.ref, t.title, s.display_name FROM questions q JOIN tasks t ON t.id=q.task_id JOIN staff s ON s.id=q.staff_id
      WHERE q.answer IS NULL ORDER BY t.ref, q.created_at`)).rows;
  const byTask = new Map<string, typeof rows>();
  for (const r of rows) byTask.set(r.ref, [...(byTask.get(r.ref) ?? []), r]);
  return [...byTask.entries()].map(([ref, qs]) => ({ taskRef: ref, title: qs[0].title, count: qs.length, questions: qs }));
}

export async function answerQuestion(c: Tx, userId: string, questionId: string, answer: string) {
  const q = (await c.query(`UPDATE questions SET answer=$2, answered_by=$3, answered_at=now() WHERE id=$1 AND answer IS NULL RETURNING *`, [questionId, answer, userId])).rows[0];
  if (!q) throw new PolicyError('not_open', 'Question already answered or not found');
  const open = await c.query(`SELECT 1 FROM questions WHERE task_id=$1 AND answer IS NULL`, [q.task_id]);
  if (!open.rowCount) await c.query(`UPDATE tasks SET side_state=NULL, blocker=NULL, updated_at=now() WHERE id=$1 AND side_state='needs_information'`, [q.task_id]);
  await emit(c, { kind: 'human', userId }, 'question.answered', { taskId: q.task_id, target: questionId, next: q.resume_stage });
  return q;
}

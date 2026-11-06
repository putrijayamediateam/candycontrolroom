import { createHash } from 'node:crypto';
import type { Tx } from '../db/pool.js';
import { myDate, myDateCompact } from '../../shared/time.js';

export class PolicyError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'PolicyError'; }
}

export type Actor =
  | { kind: 'human'; userId: string }
  | { kind: 'staff'; staffId: string }
  | { kind: 'candy_delegated'; delegationId: string; onBehalfOf: string }
  | { kind: 'system' };

export async function emit(c: Tx, actor: Actor, type: string, f: {
  taskId?: string | null; target?: string; versionId?: string | null; prev?: string | null; next?: string | null;
  reason?: string | null; data?: Record<string, unknown>; isDemo?: boolean;
} = {}) {
  const actorId = actor.kind === 'human' ? actor.userId : actor.kind === 'staff' ? actor.staffId : actor.kind === 'candy_delegated' ? 'candy' : 'system';
  const onBehalf = actor.kind === 'candy_delegated' ? actor.onBehalfOf : null;
  const data = actor.kind === 'candy_delegated' ? { ...f.data, delegation_id: actor.delegationId } : (f.data ?? {});
  await c.query(
    `INSERT INTO events (actor_kind, actor_id, on_behalf_of, type, task_id, target, version_id, prev_state, new_state, reason, data, is_demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [actor.kind, actorId, onBehalf, type, f.taskId ?? null, f.target ?? null, f.versionId ?? null, f.prev ?? null, f.next ?? null, f.reason ?? null, data, f.isDemo ?? false],
  );
}

/** Server-issued sequential ID per prefix per Malaysia date, e.g. CPR-20261106-001. */
export async function nextRef(c: Tx, prefix: string, at: Date = new Date()): Promise<{ ref: string; day: string }> {
  const day = myDate(at);
  const r = await c.query(
    `INSERT INTO pr_counters(prefix, day, last_no) VALUES ($1,$2,1)
     ON CONFLICT (prefix, day) DO UPDATE SET last_no = pr_counters.last_no + 1 RETURNING last_no`,
    [prefix, day],
  );
  return { ref: `${prefix}-${myDateCompact(at)}-${String(r.rows[0].last_no).padStart(3, '0')}`, day };
}

// ---------- Task templates ----------
export const CONTENT_FLOW = ['brief', 'research', 'copy', 'sketch', 'production', 'editing', 'qa', 'candy_review', 'awaiting_ain', 'approved', 'scheduled', 'publishing', 'published', 'performance_review'] as const;
export const DESIGN_FLOW = ['request', 'ux_brief', 'design', 'candy_design_review', 'ain_design_approval', 'implementation', 'testing', 'candy_release_review', 'ain_release_approval', 'released_verified'] as const;
const GATES = ['qa', 'candy_review', 'awaiting_ain', 'approved'];

export const TEMPLATES: Record<string, { kind: 'content' | 'design_dev'; steps: string[]; requiresConsentDefault?: boolean }> = {
  poster: { kind: 'content', steps: CONTENT_FLOW.filter((s) => s !== 'production') },
  carousel: { kind: 'content', steps: CONTENT_FLOW.filter((s) => s !== 'production') },
  short_video: { kind: 'content', steps: [...CONTENT_FLOW], requiresConsentDefault: true },
  text_psa: { kind: 'content', steps: CONTENT_FLOW.filter((s) => !['sketch', 'production', 'editing'].includes(s)) },
  campaign_announcement: { kind: 'content', steps: [...CONTENT_FLOW] },
  review_reply: { kind: 'content', steps: ['brief', 'copy', 'qa', 'candy_review', 'awaiting_ain', 'approved', 'publishing', 'published'] },
  technical_change: { kind: 'design_dev', steps: [...DESIGN_FLOW] },
  system_improvement: { kind: 'design_dev', steps: [...DESIGN_FLOW] },
};
for (const t of Object.values(TEMPLATES)) if (t.kind === 'content') for (const g of GATES) if (!t.steps.includes(g)) throw new Error(`template missing gate ${g}`);

export async function createTask(c: Tx, actor: Actor, input: {
  template: string; title: string; objective?: string; owner?: string; platforms?: string[]; audience?: string;
  contentLocale?: 'en' | 'ms' | null; requiresClinical?: boolean; requiresConsent?: boolean; isDemo?: boolean; campaignId?: string;
}) {
  const tpl = TEMPLATES[input.template];
  if (!tpl) throw new PolicyError('unknown_template', `Unknown template ${input.template}`);
  const { ref } = await nextRef(c, 'TSK');
  const r = await c.query(
    `INSERT INTO tasks (ref, kind, template, title, objective, owner_staff, platforms, audience, content_locale, stage,
                        requires_clinical, requires_consent, is_demo, campaign_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [ref, tpl.kind, input.template, input.title, input.objective ?? null, input.owner ?? null, input.platforms ?? [], input.audience ?? null,
      input.contentLocale ?? null, tpl.steps[0], input.requiresClinical ?? false, input.requiresConsent ?? tpl.requiresConsentDefault ?? false,
      input.isDemo ?? false, input.campaignId ?? null, actor.kind === 'human' ? actor.userId : null],
  );
  await emit(c, actor, 'task.created', { taskId: r.rows[0].id, next: tpl.steps[0], isDemo: input.isDemo });
  return r.rows[0];
}

/** Advance a task one step along its template. Dependencies must be complete. Gates cannot be skipped. */
export async function advanceTask(c: Tx, actor: Actor, taskId: string, toStage: string) {
  const t = (await c.query('SELECT * FROM tasks WHERE id=$1 FOR UPDATE', [taskId])).rows[0];
  if (!t) throw new PolicyError('not_found', 'Task not found');
  const steps = TEMPLATES[t.template].steps;
  const from = steps.indexOf(t.stage), to = steps.indexOf(toStage);
  if (to < 0) throw new PolicyError('invalid_stage', `${toStage} is not part of the ${t.template} workflow`);
  if (to !== from + 1) throw new PolicyError('skip_not_allowed', `Cannot move from ${t.stage} to ${toStage}; next step is ${steps[from + 1]}`);
  if (['awaiting_ain', 'approved', 'ain_design_approval', 'ain_release_approval'].includes(toStage))
    throw new PolicyError('approval_required', 'Approval stages are reached only through a recorded approval decision');
  const deps = await c.query(
    `SELECT t.ref, t.stage FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on WHERE d.task_id=$1`, [taskId]);
  const open = deps.rows.filter((d) => !['approved', 'scheduled', 'published', 'performance_review', 'released_verified'].includes(d.stage));
  if (open.length) throw new PolicyError('dependency_open', `Waiting on ${open.map((d) => d.ref).join(', ')}`);
  if (t.side_state) throw new PolicyError('task_paused', `Task is ${t.side_state}: ${t.blocker ?? ''}`);
  if (toStage === 'released_verified') {
    const ok = await c.query(
      `SELECT 1 FROM approvals a JOIN deliverable_versions v ON v.id=a.version_id
        WHERE v.task_id=$1 AND a.action='release' AND a.decision='approved' AND a.decided_by_kind='human' AND a.invalidated_at IS NULL`, [taskId]);
    if (!ok.rowCount) throw new PolicyError('release_approval_required', 'Release needs AIN\'s explicit release approval');
  }
  await c.query('UPDATE tasks SET stage=$2, updated_at=now() WHERE id=$1', [taskId, toStage]);
  await emit(c, actor, 'task.stage_changed', { taskId, prev: t.stage, next: toStage, isDemo: t.is_demo });
}

export async function setBlocked(c: Tx, actor: Actor, taskId: string, sideState: string, blocker: string) {
  await c.query('UPDATE tasks SET side_state=$2, blocker=$3, updated_at=now() WHERE id=$1', [taskId, sideState, blocker]);
  await emit(c, actor, 'task.blocked', { taskId, next: sideState, reason: blocker });
}

// ---------- Versions ----------
export function hashContent(v: { copy?: string | null; assets?: string[]; destination?: string | null; platform?: string | null; locale: string }) {
  return createHash('sha256').update(JSON.stringify([v.copy ?? '', [...(v.assets ?? [])].sort(), v.destination ?? '', v.platform ?? '', v.locale])).digest('hex');
}

/** Creates a new deliverable version. Any approvals on earlier versions of the same task/platform are invalidated. */
export async function createVersion(c: Tx, actor: Actor, input: {
  taskId: string; platform?: string | null; copy?: string; assets?: string[]; destination?: string; locale?: 'en' | 'ms';
  submittedBy?: string; translatedFrom?: string;
}) {
  const task = (await c.query('SELECT * FROM tasks WHERE id=$1 FOR UPDATE', [input.taskId])).rows[0];
  const locale = input.locale ?? task.content_locale ?? (await defaultContentLocale(c));
  const platform = input.platform ?? null;
  const prev = await c.query(
    `SELECT coalesce(max(version),0) AS v FROM deliverable_versions WHERE task_id=$1 AND platform IS NOT DISTINCT FROM $2`, [input.taskId, platform]);
  const version = Number(prev.rows[0].v) + 1;
  const hash = hashContent({ copy: input.copy, assets: input.assets, destination: input.destination, platform, locale });
  const r = await c.query(
    `INSERT INTO deliverable_versions (task_id, version, platform, copy_text, asset_keys, destination, content_locale, translated_from, content_hash, submitted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [input.taskId, version, platform, input.copy ?? null, input.assets ?? [], input.destination ?? null, locale, input.translatedFrom ?? null, hash, input.submittedBy ?? null],
  );
  const inv = await c.query(
    `UPDATE approvals a SET invalidated_at=now(), invalidated_reason=$3
       FROM deliverable_versions v
      WHERE a.version_id=v.id AND v.task_id=$1 AND v.platform IS NOT DISTINCT FROM $2 AND v.id<>$4 AND a.invalidated_at IS NULL
      RETURNING a.id`,
    [input.taskId, platform, `Superseded by version ${version}`, r.rows[0].id]);
  await c.query(
    `UPDATE review_requests rr SET status='superseded' FROM deliverable_versions v
      WHERE rr.version_id=v.id AND v.task_id=$1 AND v.platform IS NOT DISTINCT FROM $2 AND v.id<>$3 AND rr.status IN ('awaiting_candy','awaiting_ain','approved')`,
    [input.taskId, platform, r.rows[0].id]);
  await emit(c, actor, 'version.created', { taskId: input.taskId, versionId: r.rows[0].id, data: { version, invalidated_approvals: inv.rowCount }, isDemo: task.is_demo });
  return r.rows[0];
}

/** Translation creates a new reviewable version; the source stays untouched. */
export async function requestTranslation(c: Tx, actor: Actor, sourceVersionId: string, toLocale: 'en' | 'ms', translatedCopy: string) {
  const src = (await c.query('SELECT * FROM deliverable_versions WHERE id=$1', [sourceVersionId])).rows[0];
  return createVersion(c, actor, { taskId: src.task_id, platform: src.platform, copy: translatedCopy, assets: src.asset_keys, destination: src.destination, locale: toLocale, translatedFrom: src.id });
}

async function defaultContentLocale(c: Tx): Promise<'en' | 'ms'> {
  const r = await c.query(`SELECT content_locale FROM users WHERE role='owner' ORDER BY created_at LIMIT 1`);
  return r.rows[0]?.content_locale ?? 'en';
}

export async function recordCheck(c: Tx, actor: Actor, versionId: string, checkType: string, result: 'passed' | 'failed' | 'not_verified', evidence?: string) {
  const humanOnly = ['clinical_signoff', 'consent'];
  if (humanOnly.includes(checkType) && actor.kind !== 'human')
    throw new PolicyError('human_only_check', `${checkType} can only be recorded by a real human reviewer`);
  if (result === 'passed' && !evidence) throw new PolicyError('evidence_required', 'A passed check needs evidence');
  const actorId = actor.kind === 'human' ? actor.userId : actor.kind === 'staff' ? actor.staffId : 'candy';
  await c.query(`INSERT INTO checks (version_id, check_type, result, evidence, actor_kind, actor_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [versionId, checkType, result, evidence ?? null, actor.kind === 'human' ? 'human' : 'staff', actorId]);
  await emit(c, actor, 'check.recorded', { versionId, target: checkType, next: result });
}

// ---------- Review requests (CPR / DPR) ----------
export async function submitForReview(c: Tx, staffId: string, versionId: string, summary: string, at = new Date()) {
  const v = (await c.query(`SELECT v.*, t.kind AS task_kind, t.is_demo FROM deliverable_versions v JOIN tasks t ON t.id=v.task_id WHERE v.id=$1`, [versionId])).rows[0];
  if (!v) throw new PolicyError('not_found', 'Version not found');
  const prefix = v.task_kind === 'design_dev' ? 'DPR' : 'CPR';
  const { ref, day } = await nextRef(c, prefix, at);
  const r = await c.query(
    `INSERT INTO review_requests (ref, kind, my_date, task_id, version_id, submitted_by, summary, submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [ref, prefix, day, v.task_id, versionId, staffId, summary, at]);
  await emit(c, { kind: 'staff', staffId }, 'review.submitted', { taskId: v.task_id, versionId, target: ref, isDemo: v.is_demo });
  return r.rows[0];
}

/**
 * CANDY's own review. She cannot pass a version whose required evidence is missing or failed:
 * instead the task is marked Blocked (persisted) and { passed: false } is returned.
 */
export async function candyReview(c: Tx, reviewId: string, recommendation: string): Promise<{ passed: boolean; missing: string[] }> {
  const rr = (await c.query('SELECT * FROM review_requests WHERE id=$1 FOR UPDATE', [reviewId])).rows[0];
  if (rr.status !== 'awaiting_candy') throw new PolicyError('wrong_state', `Review is ${rr.status}`);
  const missing = await missingGates(c, rr.version_id);
  if (missing.length) {
    await c.query(`UPDATE tasks SET side_state='blocked', blocker=$2 WHERE id=$1`, [rr.task_id, `Missing: ${missing.join(', ')}`]);
    await emit(c, { kind: 'staff', staffId: 'candy' }, 'task.blocked', { taskId: rr.task_id, versionId: rr.version_id, reason: `Missing: ${missing.join(', ')}` });
    return { passed: false, missing };
  }
  await c.query(`UPDATE review_requests SET candy_review=$2, candy_reviewed_at=now(), status='awaiting_ain' WHERE id=$1`, [reviewId, recommendation]);
  await c.query(`UPDATE tasks SET stage = CASE stage WHEN 'candy_review' THEN 'awaiting_ain' WHEN 'candy_design_review' THEN 'ain_design_approval'
                   WHEN 'candy_release_review' THEN 'ain_release_approval' ELSE stage END, side_state=NULL, blocker=NULL, updated_at=now() WHERE id=$1`, [rr.task_id]);
  await emit(c, { kind: 'staff', staffId: 'candy' }, 'review.candy_completed', { taskId: rr.task_id, versionId: rr.version_id, target: rr.ref, reason: recommendation });
  return { passed: true, missing: [] };
}

/** Lists the gates still unmet for a version: QA, clinical, consent, and any failed/unverified checks. */
export async function missingGates(c: Tx, versionId: string): Promise<string[]> {
  const v = (await c.query(`SELECT v.*, t.requires_clinical, t.requires_consent, t.kind FROM deliverable_versions v JOIN tasks t ON t.id=v.task_id WHERE v.id=$1`, [versionId])).rows[0];
  const checks = (await c.query('SELECT check_type, result, actor_kind FROM checks WHERE version_id=$1', [versionId])).rows;
  const passed = (type: string, human = false) => checks.some((k) => k.check_type === type && k.result === 'passed' && (!human || k.actor_kind === 'human'));
  const out: string[] = [];
  if (v.kind === 'content' && !passed('qa_complete')) out.push('QA evidence');
  if (v.kind === 'design_dev' && !passed('design_spec') && !passed('test_run')) out.push('design or test evidence');
  if (v.requires_clinical && !passed('clinical_signoff', true)) out.push('clinical sign-off');
  if (v.requires_consent && !passed('consent', true)) out.push('consent record');
  for (const k of checks) if (k.result !== 'passed' && !checks.some((p) => p.check_type === k.check_type && p.result === 'passed')) out.push(`${k.check_type} (${k.result})`);
  return [...new Set(out)];
}

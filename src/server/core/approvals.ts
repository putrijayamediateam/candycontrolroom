import type { Db, Tx } from '../db/pool.js';
import { tx } from '../db/pool.js';
import { PolicyError, emit, missingGates, type Actor } from './workflow.js';

export const POLICY_VERSION = 'delegation-policy-2026-11-06';

/** Actions BECOME ME may ever cover. Deploys, spending, credentials, destructive actions are never delegable. */
export const DELEGABLE_ACTIONS = ['internal_approval', 'schedule', 'publish', 'reply'] as const;
export type DelegableAction = (typeof DELEGABLE_ACTIONS)[number];
export type ApprovalAction = DelegableAction | 'design_approval' | 'implement' | 'release';

export interface DelegationScope {
  actions: DelegableAction[];
  platforms: string[];        // empty = none
  templates: string[];        // empty = none
  campaignIds?: string[];     // undefined = any campaign
}

// ---------------- Delegation ----------------

/** BECOME ME: only an authenticated owner, with explicit confirmation, can activate. */
export async function activateDelegation(db: Db, input: {
  userId: string; scope: DelegationScope; minutes: number; includePending: boolean; confirmed: boolean; source: 'button' | 'command_input';
}) {
  if (!input.confirmed) throw new PolicyError('confirmation_required', 'Delegation needs your explicit confirmation of the full scope');
  const bad = input.scope.actions.filter((a) => !(DELEGABLE_ACTIONS as readonly string[]).includes(a));
  if (bad.length) throw new PolicyError('not_delegable', `These actions cannot be delegated: ${bad.join(', ')}`);
  if (input.minutes <= 0 || input.minutes > 7 * 24 * 60) throw new PolicyError('bad_duration', 'Duration must be between 1 minute and 7 days');
  return tx(db, async (c) => {
    const u = (await c.query(`SELECT role FROM users WHERE id=$1`, [input.userId])).rows[0];
    if (u?.role !== 'owner') throw new PolicyError('forbidden', 'Only AIN (owner) can grant delegation');
    await expireStale(c);
    const open = await c.query(`SELECT id FROM delegation_sessions WHERE revoked_at IS NULL`);
    if (open.rowCount) throw new PolicyError('already_active', 'A delegation session is already active');
    const r = await c.query(
      `INSERT INTO delegation_sessions (granted_by, scope, policy_version, include_pending, expires_at)
       VALUES ($1,$2,$3,$4, now() + make_interval(mins => $5)) RETURNING *`,
      [input.userId, input.scope, POLICY_VERSION, input.includePending, input.minutes]);
    await emit(c, { kind: 'human', userId: input.userId }, 'delegation.activated', {
      target: r.rows[0].id, data: { scope: input.scope, expires_at: r.rows[0].expires_at, include_pending: input.includePending, source: input.source, policy_version: POLICY_VERSION } });
    return r.rows[0];
  });
}

/** I'M DONE / Stop Delegation. Atomic: once committed, no worker can pass a delegated permission check. */
export async function endDelegation(db: Db, userId: string, reason: 'im_done' | 'stop' = 'im_done') {
  return tx(db, async (c) => {
    const u = (await c.query(`SELECT role FROM users WHERE id=$1`, [userId])).rows[0];
    if (u?.role !== 'owner') throw new PolicyError('forbidden', 'Only AIN can end delegation');
    const r = await c.query(`UPDATE delegation_sessions SET revoked_at=now(), revoked_reason=$1 WHERE revoked_at IS NULL RETURNING *`, [reason]);
    if (!r.rowCount) return null;
    const s = r.rows[0];
    // Pause queued side effects that rely only on this delegation
    const paused = await c.query(
      `UPDATE platform_posts p SET status='planned'
        WHERE p.status='scheduled' AND NOT EXISTS (
          SELECT 1 FROM approvals a WHERE a.version_id=p.version_id AND a.action='publish' AND a.decision='approved'
             AND a.invalidated_at IS NULL AND a.decided_by_kind='human')
          AND EXISTS (SELECT 1 FROM approvals a WHERE a.version_id=p.version_id AND a.delegation_id=$1)
        RETURNING p.id`, [s.id]);
    await emit(c, { kind: 'human', userId }, 'delegation.ended', { target: s.id, reason, data: { paused_posts: paused.rows.map((p) => p.id) } });
    return s;
  });
}

async function expireStale(c: Tx) {
  const r = await c.query(`UPDATE delegation_sessions SET revoked_at=expires_at, revoked_reason='expired' WHERE revoked_at IS NULL AND expires_at <= now() RETURNING id, granted_by`);
  for (const s of r.rows) await emit(c, { kind: 'system' }, 'delegation.expired', { target: s.id });
}

/**
 * Locks and returns the active delegation row (FOR SHARE), so a concurrent I'M DONE
 * waits for this transaction, and any check after revocation sees it revoked.
 */
async function lockActiveDelegation(c: Tx) {
  await expireStale(c);
  const r = await c.query(`SELECT * FROM delegation_sessions WHERE revoked_at IS NULL AND expires_at > now() FOR SHARE`);
  return r.rows[0] ?? null;
}

function scopeCovers(s: { scope: DelegationScope; include_pending: boolean; starts_at: Date }, action: string, ctx: { platform: string | null; template: string; campaignId: string | null; versionCreated: Date }) {
  const sc = s.scope;
  if (!sc.actions.includes(action as DelegableAction)) return `action ${action} is not in scope`;
  if (ctx.platform && !sc.platforms.includes(ctx.platform)) return `platform ${ctx.platform} is not in scope`;
  if (!sc.templates.includes(ctx.template)) return `content type ${ctx.template} is not in scope`;
  if (sc.campaignIds && (!ctx.campaignId || !sc.campaignIds.includes(ctx.campaignId))) return 'campaign is not in scope';
  if (!s.include_pending && ctx.versionCreated < new Date(s.starts_at)) return 'item was pending before delegation and pending items are not included';
  return null;
}

// ---------------- Decisions ----------------

export type Decider = { kind: 'human'; userId: string } | { kind: 'candy' };

export async function decide(db: Db, input: { reviewId: string; action: ApprovalAction; decision: 'approved' | 'changes_requested' | 'rejected'; decider: Decider; reason?: string }) {
  // Expiry is committed on its own so it persists even when the decision is refused
  await tx(db, (c) => expireStale(c));
  try {
    return await decideTx(db, input);
  } catch (e) {
    const blocked = (e as { blocked?: { delegationId: string; onBehalfOf: string; taskId: string; versionId: string; reason: string } }).blocked;
    if (blocked) await tx(db, (c) => emit(c, { kind: 'candy_delegated', delegationId: blocked.delegationId, onBehalfOf: blocked.onBehalfOf },
      'delegation.blocked_out_of_scope', { taskId: blocked.taskId, versionId: blocked.versionId, reason: blocked.reason, data: { action: input.action } }));
    throw e;
  }
}

async function decideTx(db: Db, input: { reviewId: string; action: ApprovalAction; decision: 'approved' | 'changes_requested' | 'rejected'; decider: Decider; reason?: string }) {
  return tx(db, async (c) => {
    const rr = (await c.query(`SELECT * FROM review_requests WHERE id=$1 FOR UPDATE`, [input.reviewId])).rows[0];
    if (!rr) throw new PolicyError('not_found', 'Review request not found');
    const v = (await c.query(
      `SELECT v.*, t.template, t.campaign_id, t.kind AS task_kind, t.id AS tid, t.is_demo,
              (SELECT max(version) FROM deliverable_versions x WHERE x.task_id=v.task_id AND x.platform IS NOT DISTINCT FROM v.platform) AS latest
         FROM deliverable_versions v JOIN tasks t ON t.id=v.task_id WHERE v.id=$1 FOR UPDATE OF v`, [rr.version_id])).rows[0];

    if (rr.status === 'superseded' || v.version !== v.latest) throw new PolicyError('stale_version', 'A newer version exists; review that version instead');
    if (rr.status !== 'awaiting_ain') throw new PolicyError('candy_review_required', 'CANDY must complete her review before final approval');

    if (input.decision === 'approved') {
      const missing = await missingGates(c, v.id);
      if (missing.length) throw new PolicyError('gates_unmet', `Cannot approve. Missing: ${missing.join(', ')}`);
    }
    const designActions = ['design_approval', 'implement', 'release'];
    if (v.task_kind === 'design_dev' && !designActions.includes(input.action)) throw new PolicyError('wrong_action', 'Design/development work uses design, implement, or release approvals');
    if (v.task_kind === 'content' && designActions.includes(input.action)) throw new PolicyError('wrong_action', 'Content uses content approval actions');

    let actor: Actor; let decidedByUser: string; let delegationId: string | null = null; let reason = input.reason ?? null;
    if (input.decider.kind === 'human') {
      const u = (await c.query(`SELECT role FROM users WHERE id=$1`, [input.decider.userId])).rows[0];
      if (u?.role !== 'owner') throw new PolicyError('forbidden', 'Only AIN can give final approval');
      actor = { kind: 'human', userId: input.decider.userId }; decidedByUser = input.decider.userId;
    } else {
      if (rr.submitted_by === 'candy') throw new PolicyError('self_approval', 'CANDY cannot approve her own submission');
      const s = await lockActiveDelegation(c);
      if (!s) throw new PolicyError('no_delegation', 'Manual mode: AIN must decide');
      const why = scopeCovers(s, input.action, { platform: v.platform, template: v.template, campaignId: v.campaign_id, versionCreated: v.created_at });
      if (why) {
        const err = new PolicyError('out_of_scope', `Escalated to AIN: ${why}`);
        Object.assign(err, { blocked: { delegationId: s.id, onBehalfOf: s.granted_by, taskId: v.tid, versionId: v.id, reason: why } });
        throw err;
      }
      actor = { kind: 'candy_delegated', delegationId: s.id, onBehalfOf: s.granted_by }; decidedByUser = s.granted_by; delegationId = s.id;
      reason = `Approved by CANDY under AIN's delegation. ${input.reason ?? ''}`.trim();
    }

    await c.query(
      `INSERT INTO approvals (version_id, content_hash, action, decision, decided_by_kind, decided_by_user, delegation_id, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [v.id, v.content_hash, input.action, input.decision, input.decider.kind === 'human' ? 'human' : 'candy_delegated', decidedByUser, delegationId, reason]);
    const newStatus = input.decision === 'approved' ? 'approved' : input.decision;
    await c.query(`UPDATE review_requests SET status=$2 WHERE id=$1`, [rr.id, newStatus]);
    const nextStage = input.decision !== 'approved' ? null
      : input.action === 'design_approval' ? 'implementation'
      : input.action === 'release' ? 'ain_release_approval'
      : 'approved';
    if (input.decision === 'approved' && nextStage) await c.query(`UPDATE tasks SET stage=$2, updated_at=now() WHERE id=$1`, [v.tid, nextStage]);
    if (input.decision === 'changes_requested') await c.query(`UPDATE tasks SET side_state='changes_requested', blocker=$2 WHERE id=$1`, [v.tid, input.reason ?? 'Changes requested']);
    await emit(c, actor, `approval.${input.decision}`, { taskId: v.tid, versionId: v.id, target: rr.ref, reason, data: { action: input.action, content_hash: v.content_hash, version: v.version, scope_checked: !!delegationId }, isDemo: v.is_demo });
    return { status: newStatus, attributed: input.decider.kind === 'human' ? 'AIN' : "CANDY under AIN's delegation" };
  });
}

/**
 * Called by workers immediately before any external side effect (publish, reply, schedule).
 * Requires a valid, non-invalidated approval on the exact current content hash. If the only
 * approval came from delegation, that delegation must still be active right now.
 */
export async function authorizeSideEffect(c: Tx, versionId: string, action: DelegableAction): Promise<{ ok: true; basis: 'human' | 'delegated' } | { ok: false; reason: string }> {
  const v = (await c.query(`SELECT content_hash FROM deliverable_versions WHERE id=$1`, [versionId])).rows[0];
  const pause = (await c.query(`SELECT value FROM app_settings WHERE key='publishing_paused'`)).rows[0];
  if (pause?.value === true && (action === 'publish' || action === 'reply')) return { ok: false, reason: 'Publishing is paused by AIN' };
  const approvals = (await c.query(
    `SELECT * FROM approvals WHERE version_id=$1 AND action=$2 AND decision='approved' AND invalidated_at IS NULL AND content_hash=$3`,
    [versionId, action, v.content_hash])).rows;
  if (approvals.some((a) => a.decided_by_kind === 'human')) return { ok: true, basis: 'human' };
  if (approvals.length) {
    const s = await lockActiveDelegation(c);
    if (s && approvals.some((a) => a.delegation_id === s.id)) return { ok: true, basis: 'delegated' };
    return { ok: false, reason: 'Approval relied on delegation that has ended; waiting for AIN' };
  }
  return { ok: false, reason: `No valid ${action} approval for this exact version` };
}

/** Return briefing: everything done under a delegation session, from stored events. */
export async function returnBriefing(db: Db, delegationId: string) {
  const s = (await db.query(`SELECT * FROM delegation_sessions WHERE id=$1`, [delegationId])).rows[0];
  const events = (await db.query(
    `SELECT seq, at, type, task_id, version_id, target, reason, data FROM events
      WHERE data->>'delegation_id' = $1 OR (target = $1 AND type LIKE 'delegation.%') ORDER BY seq`, [delegationId])).rows;
  const inFlight = (await db.query(
    `SELECT p.* FROM platform_posts p JOIN approvals a ON a.version_id=p.version_id AND a.delegation_id=$1 WHERE p.status IN ('publishing','unknown')`, [delegationId])).rows;
  const pending = (await db.query(`SELECT ref, task_id FROM review_requests WHERE status='awaiting_ain' ORDER BY submitted_at`)).rows;
  return {
    session: s,
    approvals: events.filter((e) => e.type.startsWith('approval.')),
    blocked: events.filter((e) => e.type === 'delegation.blocked_out_of_scope'),
    publishing: events.filter((e) => e.type.startsWith('post.')),
    inFlight,
    pendingDecisions: pending,
    allEvents: events,
  };
}

export async function acknowledgeBriefing(db: Db, userId: string, delegationId: string) {
  await tx(db, async (c) => {
    await c.query(`UPDATE delegation_sessions SET briefing_acknowledged_at=now() WHERE id=$1 AND revoked_at IS NOT NULL`, [delegationId]);
    await emit(c, { kind: 'human', userId }, 'delegation.briefing_acknowledged', { target: delegationId });
  });
}

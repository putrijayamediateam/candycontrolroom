import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPool, tx, type Db } from '../src/server/db/pool.js';
import { migrate } from '../src/server/db/migrate.js';
import { seedBase, createUser } from '../src/server/db/seed.js';
import { createTask, createVersion, recordCheck, submitForReview, candyReview, advanceTask, requestTranslation, PolicyError } from '../src/server/core/workflow.js';
import { activateDelegation, endDelegation, decide, authorizeSideEffect, returnBriefing, type DelegationScope } from '../src/server/core/approvals.js';
import { schedulePost, publishPost, setPublishingPaused, type PublishAdapter } from '../src/server/core/publishing.js';
import { dailyPrList, dailyCounters, toCsv } from '../src/server/core/reports.js';
import { briefStaff, currentInstructions, askQuestion, questionDigest, answerQuestion } from '../src/server/core/staff.js';
import { myDate, slotInstant } from '../src/shared/time.js';
import { OPERATIONAL_IDS, DESIGNER_IDS } from '../src/shared/staff.js';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/candy_test';
let db: Db; let ain: string; let doctor: string;
const H = () => ({ kind: 'human' as const, userId: ain });

beforeAll(async () => {
  db = createPool(URL);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db);
  await seedBase(db);
  ain = await createUser(db, 'ain@example.test', 'AIN', 'owner', 'test-password-1');
  doctor = await createUser(db, 'reviewer@example.test', 'Clinical Reviewer (placeholder)', 'clinical_reviewer', 'test-password-2');
});
afterAll(async () => { await db.end(); });
beforeEach(async () => {
  await db.query(`UPDATE delegation_sessions SET revoked_at=now(), revoked_reason='stop' WHERE revoked_at IS NULL`);
  await db.query(`UPDATE app_settings SET value='false' WHERE key='publishing_paused'`);
});

/** Poster through QA, ready for CANDY. */
async function readyPoster(opts: { clinical?: boolean; platform?: string; qa?: boolean } = {}) {
  return tx(db, async (c) => {
    const t = await createTask(c, H(), { template: 'poster', title: 'Placeholder flu-season poster', platforms: [opts.platform ?? 'instagram'], requiresClinical: opts.clinical, owner: 'mei' });
    const v = await createVersion(c, { kind: 'staff', staffId: 'mei' }, { taskId: t.id, platform: opts.platform ?? 'instagram', copy: '[PLACEHOLDER] Get your flu vaccine at Klinik Putrijaya.', assets: ['poster-v1.png'], destination: 'ig:@klinikputrijaya', submittedBy: 'mei' });
    if (opts.qa !== false) await recordCheck(c, { kind: 'staff', staffId: 'nadia' }, v.id, 'qa_complete', 'passed', 'Rendered PNG reviewed at 1080x1350: spelling, brand name, contrast, CTA');
    const rr = await submitForReview(c, 'mei', v.id, 'Poster v1');
    return { t, v, rr };
  });
}
const SCOPE: DelegationScope = { actions: ['internal_approval'], platforms: ['instagram', 'facebook'], templates: ['poster', 'carousel'] };

describe('roster and language defaults', () => {
  it('seeds 21 AI staff: CANDY + 12 operational + 8 Designer Team, Designer Team via Alex', async () => {
    const r = (await db.query('SELECT id, reports_to, onboarding FROM staff')).rows;
    expect(r).toHaveLength(21);
    expect(OPERATIONAL_IDS).toHaveLength(12); expect(DESIGNER_IDS).toHaveLength(8);
    for (const id of DESIGNER_IDS.filter((d) => d !== 'alex')) expect(r.find((x) => x.id === id)!.reports_to).toBe('alex');
    expect(r.find((x) => x.id === 'alex')!.reports_to).toBe('candy');
    expect(r.every((x) => x.onboarding === 'not_briefed')).toBe(true);
  });
  it('new accounts default to English for interface and content', async () => {
    const u = (await db.query('SELECT interface_locale, content_locale FROM users WHERE id=$1', [ain])).rows[0];
    expect(u).toEqual({ interface_locale: 'en', content_locale: 'en' });
  });
  it('translation creates a new reviewable version and leaves the source unchanged', async () => {
    const { v } = await readyPoster();
    const tr = await tx(db, (c) => requestTranslation(c, H(), v.id, 'ms', '[PLACEHOLDER] Malay draft'));
    expect(tr.content_locale).toBe('ms'); expect(tr.translated_from).toBe(v.id);
    const src = (await db.query('SELECT copy_text FROM deliverable_versions WHERE id=$1', [v.id])).rows[0];
    expect(src.copy_text).toContain('Get your flu vaccine');
  });
});

describe('training and questions (checks 1, 2)', () => {
  it('versioned instructions persist and stack', async () => {
    await tx(db, (c) => briefStaff(c, ain, { staffId: 'iman' }, 'Write warm, plain English captions.'));
    await tx(db, (c) => briefStaff(c, ain, { staffId: 'iman' }, 'Avoid jargon; max 2 emojis.', 'tone update'));
    const v = await tx(db, (c) => currentInstructions(c, 'iman'));
    expect(v.map((x) => x.version)).toEqual([2, 1]);
    const dept = await tx(db, (c) => briefStaff(c, ain, { department: 'designer_team' }, 'Prioritise accessibility.'));
    expect(dept).toHaveLength(8);
  });
  it('question pauses the task, appears in digest, and answer resumes it', async () => {
    const t = await tx(db, (c) => createTask(c, H(), { template: 'carousel', title: 'Postnatal tips carousel' }));
    const q = await tx(db, (c) => askQuestion(c, 'sara', t.id, { question: 'Which branch should the CTA name?', why: 'CTA must match an approved branch', recommended: 'All three branches' }));
    const digest = await tx(db, (c) => questionDigest(c));
    expect(digest.find((d) => d.taskRef === t.ref)!.count).toBe(1);
    await expect(tx(db, (c) => advanceTask(c, H(), t.id, 'research'))).rejects.toThrow(/needs_information/);
    await tx(db, (c) => answerQuestion(c, ain, q.id, 'All three branches'));
    await tx(db, (c) => advanceTask(c, H(), t.id, 'research'));
    expect((await db.query('SELECT stage FROM tasks WHERE id=$1', [t.id])).rows[0].stage).toBe('research');
  });
});

describe('workflow gates (checks 3, 4, 5)', () => {
  it('templates cannot skip steps or jump to approval', async () => {
    const t = await tx(db, (c) => createTask(c, H(), { template: 'short_video', title: 'Video' }));
    await expect(tx(db, (c) => advanceTask(c, H(), t.id, 'editing'))).rejects.toThrow(/next step is research/);
    const p = await tx(db, (c) => createTask(c, H(), { template: 'poster', title: 'Poster' }));
    await expect(tx(db, (c) => advanceTask(c, H(), p.id, 'production'))).rejects.toThrow(/not part of the poster workflow/);
  });
  it('short video requires consent by default', async () => {
    const t = await tx(db, (c) => createTask(c, H(), { template: 'short_video', title: 'Video' }));
    expect(t.requires_consent).toBe(true);
  });
  it('CANDY cannot pass work missing QA evidence; a blocker becomes visible', async () => {
    const { rr, t } = await readyPoster({ qa: false });
    const res = await tx(db, (c) => candyReview(c, rr.id, 'Looks good'));
    expect(res).toEqual({ passed: false, missing: ['QA evidence'] });
    expect((await db.query('SELECT status FROM review_requests WHERE id=$1', [rr.id])).rows[0].status).toBe('awaiting_candy');
    const task = (await db.query('SELECT side_state, blocker FROM tasks WHERE id=$1', [t.id])).rows[0];
    expect(task).toEqual({ side_state: 'blocked', blocker: 'Missing: QA evidence' });
  });
  it('clinical sign-off cannot be recorded by staff or CANDY', async () => {
    const { v } = await readyPoster({ clinical: true });
    await expect(tx(db, (c) => recordCheck(c, { kind: 'staff', staffId: 'candy' }, v.id, 'clinical_signoff', 'passed', 'ok'))).rejects.toThrow(/real human/);
  });
  it('AIN cannot approve before CANDY review; approve, then editing invalidates the approval', async () => {
    const { rr, v, t } = await readyPoster();
    await expect(decide(db, { reviewId: rr.id, action: 'internal_approval', decision: 'approved', decider: H() })).rejects.toThrow(/CANDY must complete/);
    await tx(db, (c) => candyReview(c, rr.id, 'Recommend approve'));
    const res = await decide(db, { reviewId: rr.id, action: 'internal_approval', decision: 'approved', decider: H() });
    expect(res.attributed).toBe('AIN');
    await tx(db, (c) => createVersion(c, { kind: 'staff', staffId: 'mei' }, { taskId: t.id, platform: 'instagram', copy: 'edited', assets: ['poster-v2.png'], destination: 'ig:@klinikputrijaya' }));
    const a = (await db.query('SELECT invalidated_at FROM approvals WHERE version_id=$1', [v.id])).rows[0];
    expect(a.invalidated_at).not.toBeNull();
    expect((await db.query('SELECT status FROM review_requests WHERE id=$1', [rr.id])).rows[0].status).toBe('superseded');
  });
});

describe('daily PR list (check 6)', () => {
  it('IDs are sequential per Malaysia date and lists come from stored records', async () => {
    // 23:30 UTC on 14 Mar 2030 is 07:30 on 15 Mar in Malaysia (a date no other test uses, so it never collides with "today")
    const late = new Date('2030-03-14T23:30:00Z');
    const t = await tx(db, (c) => createTask(c, H(), { template: 'text_psa', title: 'Threads PSA' }));
    const v = await tx(db, (c) => createVersion(c, H(), { taskId: t.id, platform: 'threads', copy: 'PSA' }));
    const a = await tx(db, (c) => submitForReview(c, 'iman', v.id, 'PSA v1', late));
    const b = await tx(db, (c) => submitForReview(c, 'iman', v.id, 'PSA v1 again', late));
    expect(a.ref).toBe('CPR-20300315-001'); expect(b.ref).toBe('CPR-20300315-002');
    const list = await dailyPrList(db, '2030-03-15', 'CPR');
    expect(list.map((x) => x.ref)).toEqual(['CPR-20300315-001', 'CPR-20300315-002']);
    expect(toCsv(list).split('\n')[0]).toContain('ref');
    expect(await dailyPrList(db, '2030-03-16')).toEqual([]);
  });
});

describe('delegation (checks 7-11, 25)', () => {
  it('manual mode: CANDY cannot approve without an active delegation', async () => {
    const { rr } = await readyPoster();
    await tx(db, (c) => candyReview(c, rr.id, 'ok'));
    await expect(decide(db, { reviewId: rr.id, action: 'internal_approval', decision: 'approved', decider: { kind: 'candy' } })).rejects.toThrow(/Manual mode/);
  });
  it('BECOME ME requires explicit confirmation and owner role; deploys/spend are never delegable', async () => {
    await expect(activateDelegation(db, { userId: ain, scope: SCOPE, minutes: 60, includePending: false, confirmed: false, source: 'button' })).rejects.toThrow(/explicit confirmation/);
    await expect(activateDelegation(db, { userId: doctor, scope: SCOPE, minutes: 60, includePending: false, confirmed: true, source: 'button' })).rejects.toThrow(/Only AIN/);
    await expect(activateDelegation(db, { userId: ain, scope: { ...SCOPE, actions: ['release' as never] }, minutes: 60, includePending: false, confirmed: true, source: 'button' })).rejects.toThrow(/cannot be delegated/);
  });
  it('in-scope approvals are attributed to CANDY under delegation; out-of-scope escalate; I\'M DONE stops further decisions', async () => {
    const s = await activateDelegation(db, { userId: ain, scope: SCOPE, minutes: 60, includePending: false, confirmed: true, source: 'button' });
    const ok = await readyPoster({ platform: 'instagram' });
    await tx(db, (c) => candyReview(c, ok.rr.id, 'ok'));
    const res = await decide(db, { reviewId: ok.rr.id, action: 'internal_approval', decision: 'approved', decider: { kind: 'candy' }, reason: 'Brand-compliant' });
    expect(res.attributed).toBe("CANDY under AIN's delegation");
    const a = (await db.query('SELECT * FROM approvals WHERE version_id=$1', [ok.v.id])).rows[0];
    expect(a.decided_by_kind).toBe('candy_delegated'); expect(a.delegation_id).toBe(s.id); expect(a.reason).toMatch(/^Approved by CANDY under AIN's delegation/);

    const tiktok = await readyPoster({ platform: 'tiktok' });
    await tx(db, (c) => candyReview(c, tiktok.rr.id, 'ok'));
    await expect(decide(db, { reviewId: tiktok.rr.id, action: 'internal_approval', decision: 'approved', decider: { kind: 'candy' } })).rejects.toThrow(/platform tiktok is not in scope/);
    await expect(decide(db, { reviewId: tiktok.rr.id, action: 'publish', decision: 'approved', decider: { kind: 'candy' } })).rejects.toThrow(/not in scope/);

    await endDelegation(db, ain, 'im_done');
    const after = await readyPoster({ platform: 'instagram' });
    await tx(db, (c) => candyReview(c, after.rr.id, 'ok'));
    await expect(decide(db, { reviewId: after.rr.id, action: 'internal_approval', decision: 'approved', decider: { kind: 'candy' } })).rejects.toThrow(/Manual mode/);

    const brief = await returnBriefing(db, s.id);
    expect(brief.approvals).toHaveLength(1);
    expect(brief.blocked.length).toBeGreaterThanOrEqual(2);
    expect(brief.pendingDecisions.map((p) => p.ref)).toContain(tiktok.rr.ref);
  });
  it('pending items are excluded unless included in scope', async () => {
    const before = await readyPoster();
    await tx(db, (c) => candyReview(c, before.rr.id, 'ok'));
    await activateDelegation(db, { userId: ain, scope: SCOPE, minutes: 60, includePending: false, confirmed: true, source: 'button' });
    await expect(decide(db, { reviewId: before.rr.id, action: 'internal_approval', decision: 'approved', decider: { kind: 'candy' } })).rejects.toThrow(/pending items are not included/);
  });
  it('expiry ends delegation automatically on the server', async () => {
    const s = await activateDelegation(db, { userId: ain, scope: SCOPE, minutes: 60, includePending: true, confirmed: true, source: 'button' });
    await db.query(`UPDATE delegation_sessions SET starts_at=now()-interval '2 hours', expires_at=now()-interval '1 minute' WHERE id=$1`, [s.id]);
    const p = await readyPoster();
    await tx(db, (c) => candyReview(c, p.rr.id, 'ok'));
    await expect(decide(db, { reviewId: p.rr.id, action: 'internal_approval', decision: 'approved', decider: { kind: 'candy' } })).rejects.toThrow(/Manual mode/);
    expect((await db.query('SELECT revoked_reason FROM delegation_sessions WHERE id=$1', [s.id])).rows[0].revoked_reason).toBe('expired');
  });
  it("concurrent I'M DONE vs permission check: revocation waits for in-flight check, later checks fail", async () => {
    const pubScope: DelegationScope = { actions: ['internal_approval', 'schedule', 'publish'], platforms: ['instagram'], templates: ['poster'] };
    const s = await activateDelegation(db, { userId: ain, scope: pubScope, minutes: 60, includePending: true, confirmed: true, source: 'button' });
    const p = await readyPoster();
    await tx(db, (c) => candyReview(c, p.rr.id, 'ok'));
    await decide(db, { reviewId: p.rr.id, action: 'internal_approval', decision: 'approved', decider: { kind: 'candy' } });
    await db.query(`UPDATE review_requests SET status='awaiting_ain' WHERE id=$1`, [p.rr.id]);
    await decide(db, { reviewId: p.rr.id, action: 'schedule', decision: 'approved', decider: { kind: 'candy' } });
    await db.query(`UPDATE review_requests SET status='awaiting_ain' WHERE id=$1`, [p.rr.id]);
    await decide(db, { reviewId: p.rr.id, action: 'publish', decision: 'approved', decider: { kind: 'candy' } });
    const post = await schedulePost(db, { kind: 'candy_delegated', delegationId: s.id, onBehalfOf: ain }, { taskId: p.t.id, versionId: p.v.id, platform: 'instagram', format: 'feed_image', slotAt: slotInstant('2026-11-07', '12:00') });

    // Worker holds a permission check open; I'M DONE must wait for it
    const worker = await db.connect();
    await worker.query('BEGIN');
    const held = await authorizeSideEffect(worker, p.v.id, 'publish');
    expect(held.ok).toBe(true);
    let revoked = false;
    const revoke = endDelegation(db, ain, 'im_done').then(() => { revoked = true; });
    await new Promise((r) => setTimeout(r, 150));
    expect(revoked).toBe(false);          // blocked by the in-flight check
    await worker.query('COMMIT'); worker.release();
    await revoke; expect(revoked).toBe(true);

    // Queued post relying only on delegation is paused for AIN
    expect((await db.query('SELECT status FROM platform_posts WHERE id=$1', [post.id])).rows[0].status).toBe('planned');
    const again = await tx(db, (c) => authorizeSideEffect(c, p.v.id, 'publish'));
    expect(again.ok).toBe(false);
  });
});

describe('publishing safety (checks 12, 13, 14)', () => {
  async function approvedForPublish(platform = 'instagram') {
    const p = await readyPoster({ platform });
    await tx(db, (c) => candyReview(c, p.rr.id, 'ok'));
    for (const action of ['internal_approval', 'schedule', 'publish'] as const) {
      await db.query(`UPDATE review_requests SET status='awaiting_ain' WHERE id=$1`, [p.rr.id]);
      await decide(db, { reviewId: p.rr.id, action, decision: 'approved', decider: H() });
    }
    return p;
  }
  function fakeAdapter(): PublishAdapter & { calls: number } {
    const store = new Map<string, string>();
    return { platform: 'instagram', capabilities: { feed_image: true, story: false }, calls: 0,
      async publish({ idempotencyKey }) { this.calls++; const id = `prov-${this.calls}`; store.set(idempotencyKey, id); return { providerPostId: id, confirmed: true }; },
      async lookup(k) { const id = store.get(k); return id ? { providerPostId: id } : null; } };
  }

  it('duplicate schedule + repeated publish never publishes twice; counts need confirmation', async () => {
    const p = await approvedForPublish();
    const slot = slotInstant('2026-11-10', '13:00');
    const a = await schedulePost(db, H(), { taskId: p.t.id, versionId: p.v.id, platform: 'instagram', format: 'feed_image', slotAt: slot });
    const b = await schedulePost(db, H(), { taskId: p.t.id, versionId: p.v.id, platform: 'instagram', format: 'feed_image', slotAt: slot });
    expect(a.id).toBe(b.id);
    const ad = fakeAdapter();
    const [r1, r2] = await Promise.all([publishPost(db, a.id, ad), publishPost(db, a.id, ad)]);
    await publishPost(db, a.id, ad);
    expect(ad.calls).toBe(1);
    expect([r1, r2].some((r) => 'status' in r && r.status === 'published')).toBe(true);
    const counters = await dailyCounters(db, '2026-11-10');
    const ig = counters.find((x) => x.platform === 'instagram')!;
    expect(ig.published).toBe(1); expect(ig.shortfall).toBe(2); expect(ig.target).toBe(3);
    expect(counters.map((c) => c.platform)).toEqual(expect.arrayContaining(['facebook', 'instagram', 'tiktok', 'threads']));
  });
  it('ambiguous outcome is reconciled with the provider before retry', async () => {
    const p = await approvedForPublish();
    const post = await schedulePost(db, H(), { taskId: p.t.id, versionId: p.v.id, platform: 'instagram', format: 'feed_image', slotAt: slotInstant('2026-11-11', '17:00') });
    const ad = fakeAdapter();
    const flaky: PublishAdapter = { ...ad, async publish(x) { await ad.publish(x); throw new Error('timeout after send'); }, lookup: ad.lookup.bind(ad) };
    expect(await publishPost(db, post.id, flaky)).toEqual({ status: 'unknown' });
    expect(await publishPost(db, post.id, flaky)).toEqual({ status: 'published' });
  });
  it('disconnected platform or unsupported format becomes a manual handoff, not fake success', async () => {
    const p = await approvedForPublish();
    const post = await schedulePost(db, H(), { taskId: p.t.id, versionId: p.v.id, platform: 'instagram', format: 'feed_image', slotAt: slotInstant('2026-11-12', '20:00') });
    expect(await publishPost(db, post.id, null)).toEqual({ skip: 'manual_handoff' });
    const story = await schedulePost(db, H(), { taskId: p.t.id, versionId: p.v.id, platform: 'instagram', format: 'story', isStory: true, slotAt: slotInstant('2026-11-12', '20:00') });
    expect(await publishPost(db, story.id, fakeAdapter())).toEqual({ skip: 'unsupported_format' });
    const c = (await dailyCounters(db, '2026-11-12')).find((x) => x.platform === 'instagram')!;
    expect(c.published).toBe(0); expect(c.manualPending).toBe(1);
  });
  it('Pause Publishing blocks dispatch even with valid approval', async () => {
    const p = await approvedForPublish();
    const post = await schedulePost(db, H(), { taskId: p.t.id, versionId: p.v.id, platform: 'instagram', format: 'feed_image', slotAt: slotInstant('2026-11-13', '12:00') });
    await setPublishingPaused(db, ain, true);
    const r = await publishPost(db, post.id, fakeAdapter());
    expect(r).toMatchObject({ skip: 'not_authorized', reason: 'Publishing is paused by AIN' });
  });
});

describe('Designer Studio DPR flow (checks 24, 25)', () => {
  it('moves from request to released/verified with separate design and release approvals by AIN', async () => {
    const t = await tx(db, (c) => createTask(c, H(), { template: 'system_improvement', title: 'Add keyboard shortcuts to Approval Inbox', owner: 'alex' }));
    await tx(db, (c) => advanceTask(c, H(), t.id, 'ux_brief'));
    await tx(db, (c) => advanceTask(c, H(), t.id, 'design'));
    const wire = await tx(db, (c) => createVersion(c, { kind: 'staff', staffId: 'aisha' }, { taskId: t.id, copy: 'Wireframe v1', assets: ['wireframe-v1.png'], submittedBy: 'aisha' }));
    await tx(db, (c) => recordCheck(c, { kind: 'staff', staffId: 'alex' }, wire.id, 'design_spec', 'passed', 'Wireframe covers inbox list + detail states'));
    await tx(db, (c) => advanceTask(c, H(), t.id, 'candy_design_review'));
    const dpr = await tx(db, (c) => submitForReview(c, 'alex', wire.id, 'Design for review'));
    expect(dpr.ref).toMatch(/^DPR-\d{8}-\d{3}$/);
    await tx(db, (c) => candyReview(c, dpr.id, 'Recommend approve design'));
    await decide(db, { reviewId: dpr.id, action: 'design_approval', decision: 'approved', decider: H() });
    expect((await db.query('SELECT stage FROM tasks WHERE id=$1', [t.id])).rows[0].stage).toBe('implementation');

    await tx(db, (c) => advanceTask(c, H(), t.id, 'testing'));
    await tx(db, (c) => advanceTask(c, H(), t.id, 'candy_release_review'));
    const build = await tx(db, (c) => createVersion(c, { kind: 'staff', staffId: 'ethan' }, { taskId: t.id, copy: 'Implementation build abc123 (local, no repo PR)', submittedBy: 'ethan' }));
    await tx(db, (c) => recordCheck(c, { kind: 'staff', staffId: 'lina' }, build.id, 'test_run', 'passed', 'Vitest + Playwright keyboard suite: 14/14 passed'));
    const rel = await tx(db, (c) => submitForReview(c, 'ryan', build.id, 'Release candidate'));
    expect(rel.repo_pr_url).toBeNull();
    await expect(tx(db, (c) => advanceTask(c, H(), t.id, 'released_verified'))).rejects.toThrow();
    await tx(db, (c) => candyReview(c, rel.id, 'Recommend release'));
    // CANDY cannot release even with delegation
    await activateDelegation(db, { userId: ain, scope: { actions: ['internal_approval'], platforms: [], templates: ['system_improvement'] }, minutes: 30, includePending: true, confirmed: true, source: 'button' });
    await expect(decide(db, { reviewId: rel.id, action: 'release', decision: 'approved', decider: { kind: 'candy' } })).rejects.toThrow(/not in scope/);
    await decide(db, { reviewId: rel.id, action: 'release', decision: 'approved', decider: H() });
    await tx(db, (c) => advanceTask(c, H(), t.id, 'released_verified'));
    expect((await db.query('SELECT stage FROM tasks WHERE id=$1', [t.id])).rows[0].stage).toBe('released_verified');
  });
});

describe('audit integrity', () => {
  it('events are append-only', async () => {
    await expect(db.query(`UPDATE events SET reason='tampered'`)).rejects.toThrow(/append-only/);
    await expect(db.query(`DELETE FROM events`)).rejects.toThrow(/append-only/);
  });
  it('Malaysia date helper handles the UTC day boundary', () => {
    expect(myDate(new Date('2026-11-06T15:59:00Z'))).toBe('2026-11-06');
    expect(myDate(new Date('2026-11-06T16:00:00Z'))).toBe('2026-11-07');
  });
});

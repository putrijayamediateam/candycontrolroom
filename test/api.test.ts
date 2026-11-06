import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createPool, tx, type Db } from '../src/server/db/pool.js';
import { migrate } from '../src/server/db/migrate.js';
import { seedBase, createUser } from '../src/server/db/seed.js';
import { buildApp } from '../src/server/app.js';
import { EventHub } from '../src/server/events.js';
import { sessionIdFor } from '../src/server/auth.js';
import { createVersion, recordCheck, submitForReview, candyReview } from '../src/server/core/workflow.js';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/candy_test';
let db: Db; let app: FastifyInstance; let hub: EventHub; let base: string;
let ainCookie = ''; let reviewerCookie = '';
const AIN = { email: 'ain@example.test', password: 'correct-horse-battery-1' };
const REVIEWER = { email: 'helper@example.test', password: 'another-long-password-2' };

type Res = { status: number; json: any; headers: Record<string, any>; body: string };
async function api(method: string, url: string, body?: unknown, cookie = ainCookie, csrf = true): Promise<Res> {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-candy-request'] = '1';
  const r = await app.inject({ method: method as any, url, headers, ...(body === undefined ? {} : { payload: body as any }) });
  let json: any = null; try { json = r.json(); } catch { /* not json */ }
  return { status: r.statusCode, json, headers: r.headers, body: r.body };
}
const cookieFrom = (r: Res) => String(r.headers['set-cookie']).split(';')[0];

beforeAll(async () => {
  db = createPool(URL);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db);
  await seedBase(db);
  await createUser(db, AIN.email, 'AIN', 'owner', AIN.password);
  await createUser(db, REVIEWER.email, 'Helper (placeholder)', 'reviewer', REVIEWER.password);
  hub = new EventHub(db, URL);
  await hub.start();
  app = await buildApp({ db, hub, assetsDir: 'assets', streamHeartbeatMs: 200 });
  base = await app.listen({ port: 0, host: '127.0.0.1' });
});
afterAll(async () => { await app.close(); await hub.stop(); await db.end(); });

describe('authentication and sessions', () => {
  it('health is public; everything else needs a session', async () => {
    expect((await api('GET', '/api/health', undefined, '')).json.db).toBe(true);
    const r = await api('GET', '/api/me', undefined, '');
    expect(r.status).toBe(401);
  });

  it('rejects state-changing requests without the anti-CSRF header', async () => {
    const r = await api('POST', '/api/auth/login', AIN, '', false);
    expect(r.status).toBe(403);
    expect(r.json.error).toBe('csrf');
  });

  it('wrong password fails; repeated failures are throttled', async () => {
    expect((await api('POST', '/api/auth/login', { email: 'nobody@example.test', password: 'x' }, '')).status).toBe(401);
    for (let i = 0; i < 4; i++) await api('POST', '/api/auth/login', { email: 'nobody@example.test', password: 'x' }, '');
    expect((await api('POST', '/api/auth/login', { email: 'nobody@example.test', password: 'x' }, '')).status).toBe(429);
  });

  it('login sets an HttpOnly SameSite=Strict cookie; the DB stores only a hash of the token', async () => {
    const r = await api('POST', '/api/auth/login', AIN, '');
    expect(r.status).toBe(200);
    const sc = String(r.headers['set-cookie']);
    expect(sc).toContain('HttpOnly'); expect(sc).toContain('SameSite=Strict');
    ainCookie = cookieFrom(r);
    const token = ainCookie.split('=')[1];
    const rows = (await db.query('SELECT id FROM sessions')).rows.map((x) => x.id);
    expect(rows).not.toContain(token);
    expect(rows).toContain(sessionIdFor(token));
    const me = await api('GET', '/api/me');
    expect(me.json.user).toMatchObject({ display_name: 'AIN', role: 'owner', interface_locale: 'en', content_locale: 'en' });
    expect(me.json.user.password_hash).toBeUndefined();
    reviewerCookie = cookieFrom(await api('POST', '/api/auth/login', REVIEWER, ''));
  });

  it('language preferences persist and are validated', async () => {
    expect((await api('PATCH', '/api/me/preferences', { interfaceLocale: 'xx' })).status).toBe(400);
    await api('PATCH', '/api/me/preferences', { interfaceLocale: 'ms', onboardingDone: true });
    expect((await api('GET', '/api/me')).json.user).toMatchObject({ interface_locale: 'ms', content_locale: 'en', onboarding_done: true });
    await api('PATCH', '/api/me/preferences', { interfaceLocale: 'en' });
  });
});

describe('staff, tasks and approvals over HTTP', () => {
  let taskId = ''; let reviewId = '';

  it('lists 21 staff and keeps renames and versioned briefings', async () => {
    expect((await api('GET', '/api/staff')).json.staff).toHaveLength(21);
    await api('PATCH', '/api/staff/iman', { displayName: 'Iman R.' });
    await api('POST', '/api/staff/brief', { staffId: 'iman', body: 'Write short, warm English captions.' });
    await api('POST', '/api/staff/brief', { staffId: 'iman', body: 'Write short, warm English captions. Max 2 emojis.', changeNote: 'emoji limit' });
    const d = (await api('GET', '/api/staff/iman')).json;
    expect(d.staff.display_name).toBe('Iman R.');
    expect(d.instructions.map((i: any) => i.version)).toEqual([2, 1]);
    expect(d.staff.onboarding).toBe('learning');
  });

  it('a reviewer (non-owner) cannot brief staff or create tasks', async () => {
    expect((await api('POST', '/api/staff/brief', { all: true, body: 'x' }, reviewerCookie)).status).toBe(403);
    expect((await api('POST', '/api/tasks', { template: 'poster', title: 'x' }, reviewerCookie)).status).toBe(403);
  });

  it('creates a task and refuses to skip stages or jump to approval', async () => {
    const r = await api('POST', '/api/tasks', { template: 'poster', title: '[PLACEHOLDER] API poster', owner: 'mei', platforms: ['instagram'] });
    expect(r.status).toBe(200);
    taskId = r.json.task.id;
    expect(r.json.task.ref).toMatch(/^TSK-\d{8}-\d{3}$/);
    expect((await api('POST', `/api/tasks/${taskId}/advance`, { toStage: 'qa' })).json.error).toBe('skip_not_allowed');
    for (const s of ['research', 'copy', 'sketch', 'editing', 'qa', 'candy_review']) expect((await api('POST', `/api/tasks/${taskId}/advance`, { toStage: s })).status).toBe(200);
    expect((await api('POST', `/api/tasks/${taskId}/advance`, { toStage: 'awaiting_ain' })).json.error).toBe('approval_required');
  });

  it('AIN approves the exact submitted version after CANDY review; daily list and export reflect it', async () => {
    await tx(db, async (c) => {
      const v = await createVersion(c, { kind: 'staff', staffId: 'mei' }, { taskId, platform: 'instagram', copy: '[PLACEHOLDER] copy', assets: ['assets/posters/influenza-en.png'], destination: 'ig:@klinikputrijaya', submittedBy: 'mei' });
      await recordCheck(c, { kind: 'staff', staffId: 'nadia' }, v.id, 'qa_complete', 'passed', 'Rendered PNG reviewed');
      const rr = await submitForReview(c, 'mei', v.id, 'v1');
      reviewId = rr.id;
    });
    // Before CANDY's review AIN cannot give final approval
    expect((await api('POST', `/api/reviews/${reviewId}/decision`, { action: 'internal_approval', decision: 'approved' })).json.error).toBe('candy_review_required');
    await tx(db, (c) => candyReview(c, reviewId, 'Recommend approve'));
    const awaiting = (await api('GET', '/api/reviews/awaiting')).json.reviews;
    expect(awaiting.find((r: any) => r.id === reviewId)).toMatchObject({ copy_text: '[PLACEHOLDER] copy', version: 1 });
    // Rejecting needs a reason; reviewers cannot decide
    expect((await api('POST', `/api/reviews/${reviewId}/decision`, { action: 'internal_approval', decision: 'rejected' })).status).toBe(400);
    expect((await api('POST', `/api/reviews/${reviewId}/decision`, { action: 'internal_approval', decision: 'approved' }, reviewerCookie)).status).toBe(403);
    const ok = await api('POST', `/api/reviews/${reviewId}/decision`, { action: 'internal_approval', decision: 'approved', reason: 'Looks right' });
    expect(ok.json).toEqual({ status: 'approved', attributed: 'AIN' });
    const list = (await api('GET', '/api/reviews')).json.reviews;
    expect(list.find((r: any) => r.id === reviewId)).toMatchObject({ status: 'approved', decided_by: 'AIN' });
    const csv = await api('GET', '/api/reviews/export?format=csv');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body.split('\n')[0]).toContain('ref');
    // Malaysia business date stays exactly as stored (no UTC shift to the previous day)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
    expect(csv.body.split('\n')[1]).toContain(`,${today},`);
    const detail = (await api('GET', `/api/tasks/${taskId}`)).json;
    expect(detail.task.stage).toBe('approved');
    expect(detail.versions[0].missing_gates).toEqual([]);
  });

  it('malformed ids give a clear 400, unknown ids a 404', async () => {
    expect((await api('GET', '/api/tasks/not-a-uuid')).status).toBe(400);
    expect((await api('GET', '/api/tasks/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });
});

describe('BECOME ME / I\'M DONE over HTTP', () => {
  it('typing BECOME ME only opens the scope panel; nothing is activated', async () => {
    const r = await api('POST', '/api/commands', { text: '  become   me ' });
    expect(r.json).toEqual({ command: 'become_me', next: 'open_delegation_panel' });
    expect((await api('GET', '/api/delegation')).json.mode).toBe('manual');
  });

  it('activation needs an explicit confirmation and refuses non-delegable actions', async () => {
    const scope = { actions: ['internal_approval'], platforms: ['instagram'], templates: ['poster'] };
    expect((await api('POST', '/api/delegation/activate', { scope, minutes: 60, includePending: false, confirmed: false })).status).toBe(400);
    expect((await api('POST', '/api/delegation/activate', { scope: { ...scope, actions: ['release'] }, minutes: 60, includePending: false, confirmed: true })).status).toBe(400);
    expect((await api('POST', '/api/delegation/activate', { scope, minutes: 60, includePending: false, confirmed: true }, reviewerCookie)).status).toBe(403);
    const ok = await api('POST', '/api/delegation/activate', { scope, minutes: 60, includePending: false, confirmed: true });
    expect(ok.status).toBe(200);
    const ov = (await api('GET', '/api/overview')).json;
    expect(ov.approval_mode).toBe('delegated');
    expect(ov.staff_execution.state).toBe('offline');
  });

  it("I'M DONE (with a curly apostrophe) restores Manual and returns the briefing", async () => {
    const r = await api('POST', '/api/commands', { text: 'I’m done' });
    expect(r.json.command).toBe('im_done');
    expect(r.json.ended.revoked_reason).toBe('im_done');
    expect(r.json.briefing.session.id).toBe(r.json.ended.id);
    const d = (await api('GET', '/api/delegation')).json;
    expect(d.mode).toBe('manual');
    expect(d.unacknowledged_briefings).toContain(r.json.ended.id);
    await api('POST', `/api/delegation/${r.json.ended.id}/acknowledge`);
    expect((await api('GET', '/api/delegation')).json.unacknowledged_briefings).not.toContain(r.json.ended.id);
  });

  it('only exact commands are recognised', async () => {
    expect((await api('POST', '/api/commands', { text: 'please become me now' })).json.error).toBe('unknown_command');
  });
});

describe('assets, targets and publishing pause', () => {
  it('serves real poster files but never files outside assets/', async () => {
    const ok = await api('GET', '/api/assets/posters/influenza-en.png');
    expect(ok.status).toBe(200); expect(ok.headers['content-type']).toBe('image/png');
    expect((await api('GET', '/api/assets/../.env')).status).toBe(404);
    expect((await api('GET', '/api/assets/..%2f.env')).status).toBe(404);
    expect((await api('GET', '/api/assets/build.py')).status).toBe(404);
    expect((await api('GET', '/api/assets/posters/influenza-en.png', undefined, '')).status).toBe(401);
  });

  it('GBP target is configurable separately; Stories do not count by default', async () => {
    const t = (await api('GET', '/api/targets')).json.targets;
    expect(t.find((x: any) => x.platform === 'gbp').feed_target).toBe(0);
    expect(t.find((x: any) => x.platform === 'instagram')).toMatchObject({ feed_target: 3, stories_count_toward_feed: false });
    const r = await api('PUT', '/api/targets/gbp', { feedTarget: 1, storyTarget: 0, storiesCountTowardFeed: false, slots: ['13:00', '12:00', '12:00'] });
    expect(r.json.target).toMatchObject({ feed_target: 1, slots: ['12:00', '13:00'] });
    expect((await api('PUT', '/api/targets/gbp', { feedTarget: 1, storyTarget: 0, storiesCountTowardFeed: false, slots: ['25:00'] })).status).toBe(400);
  });

  it('Pause Publishing is recorded and visible on the overview', async () => {
    await api('POST', '/api/publishing/pause', { paused: true });
    expect((await api('GET', '/api/overview')).json.publishing_paused).toBe(true);
    await api('POST', '/api/publishing/pause', { paused: false });
  });

  it('connections never expose secrets', async () => {
    const c = (await api('GET', '/api/connections')).json.connections;
    expect(c.length).toBeGreaterThan(0);
    for (const x of c) { expect(x.secret_ciphertext).toBeUndefined(); expect(x.status).toBe('not_connected'); }
  });
});

describe('live event stream (SSE)', () => {
  /** Reads SSE frames until `until` matches one or the timeout passes. */
  async function readStream(path: string, cookie: string, until: (frames: { event: string; data: any; id?: string }[]) => boolean, action?: () => Promise<unknown>, ms = 5000) {
    const ac = new AbortController();
    const res = await fetch(base + path, { headers: { cookie }, signal: ac.signal });
    const frames: { event: string; data: any; id?: string }[] = [];
    if (res.status !== 200) { ac.abort(); return { status: res.status, frames }; }
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = ''; let acted = false;
    const deadline = Date.now() + ms;
    try {
      while (Date.now() < deadline && !until(frames)) {
        const chunk = await Promise.race([reader.read(), new Promise<null>((r) => setTimeout(() => r(null), 250))]);
        if (chunk && 'done' in chunk) { if (chunk.done) break; buf += dec.decode(chunk.value, { stream: true }); }
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const raw = buf.slice(0, i); buf = buf.slice(i + 2);
          const f: any = { event: 'message' };
          for (const line of raw.split('\n')) {
            if (line.startsWith('event: ')) f.event = line.slice(7);
            else if (line.startsWith('data: ')) f.data = JSON.parse(line.slice(6));
            else if (line.startsWith('id: ')) f.id = line.slice(4);
          }
          if (f.data !== undefined) frames.push(f);
        }
        if (!acted && action && frames.some((f) => f.event === 'ready' || f.event === 'replay_done')) { acted = true; await action(); }
      }
    } finally { ac.abort(); }
    return { status: res.status, frames };
  }

  it('requires a session', async () => {
    expect((await readStream('/api/events/stream', '', () => true)).status).toBe(401);
  });

  it('replays stored events after a given id, then delivers new committed events live', async () => {
    const r = await readStream('/api/events/stream?after=0', ainCookie,
      (f) => f.some((x) => x.event === 'candy' && x.data.type === 'staff.briefed' && x.data.target === 'zoe'),
      () => api('POST', '/api/staff/brief', { staffId: 'zoe', body: 'Readable avatars at preview size.' }));
    const candy = r.frames.filter((f) => f.event === 'candy');
    expect(r.frames.some((f) => f.event === 'replay_done')).toBe(true);
    expect(candy.some((f) => f.data.type === 'approval.approved')).toBe(true);          // replayed history
    expect(candy.some((f) => f.data.type === 'staff.briefed' && f.data.target === 'zoe')).toBe(true); // live
    expect(candy.every((f) => f.id === f.data.seq)).toBe(true);
    expect(candy.some((f) => f.data.type.startsWith('auth.'))).toBe(false);           // private events stay private
    expect(new Set(candy.map((f) => f.id)).size).toBe(candy.length);                  // no duplicates
  });

  it('Last-Event-ID resumes without resending everything', async () => {
    const max = Number((await db.query(`SELECT max(seq) AS m FROM events`)).rows[0].m);
    const r = await readStream(`/api/events/stream?after=${max}`, ainCookie, (f) => f.some((x) => x.event === 'replay_done'));
    const candy = r.frames.filter((f) => f.event === 'candy');
    expect(candy.length).toBeLessThanOrEqual(50);
  });

  it('logging out ends the session and its open streams', async () => {
    const tmp = cookieFrom(await api('POST', '/api/auth/login', AIN, ''));
    const r = await readStream('/api/events/stream', tmp, (f) => f.some((x) => x.event === 'session_ended'),
      () => api('POST', '/api/auth/logout', undefined, tmp));
    expect(r.frames.some((f) => f.event === 'session_ended')).toBe(true);
    expect((await api('GET', '/api/me', undefined, tmp)).status).toBe(401);
  });
});

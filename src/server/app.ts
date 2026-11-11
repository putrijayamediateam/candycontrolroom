import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from './db/pool.js';
import { tx } from './db/pool.js';
import {
  LoginThrottle, SESSION_COOKIE, clearedCookie, login, logout, parseCookies, sessionCookie, setPassword, userForToken, type SessionUser,
} from './auth.js';
import { EVENT_COLS, type EventHub, type EventRow } from './events.js';
import { PolicyError, TEMPLATES, advanceTask, createTask, createVersion, emit, missingGates, recordCheck, requestTranslation, type Actor } from './core/workflow.js';
import { DELEGABLE_ACTIONS, POLICY_VERSION, acknowledgeBriefing, activateDelegation, decide, endDelegation, returnBriefing } from './core/approvals.js';
import { setPublishingPaused } from './core/publishing.js';
import { CORE_PLATFORMS, dailyCounters, dailyPrList, toCsv } from './core/reports.js';
import { answerQuestion, briefStaff, currentInstructions, questionDigest } from './core/staff.js';
import { myDate } from '../shared/time.js';
import { verify } from '@node-rs/argon2';
import { registerUploadRoutes } from './uploads.js';
import { registerChatRoutes, workerStatus } from './chatRoutes.js';

declare module 'fastify' {
  interface FastifyRequest { user?: SessionUser; sessionToken?: string }
}

export interface AppOptions {
  db: Db;
  hub?: EventHub | null;
  assetsDir?: string;
  /** Built web app directory (web/dist). When set, non-API paths serve the app. */
  webDir?: string;
  /** Private storage for uploads (default ./storage). */
  storageDir?: string;
  maxUploadBytes?: number;
  /** Token a Claude session uses to answer chats as staff (scoped to chat only). */
  workerToken?: string | null;
  secureCookies?: boolean;
  logger?: boolean;
  /** Heartbeat interval for the event stream (ms). */
  streamHeartbeatMs?: number;
  /**
   * Behind a hosting proxy: how many proxy hops to trust for the client IP (X-Forwarded-For), so the
   * login throttle sees the real address. false (default) = use the socket address. Never trust all hops.
   */
  trustProxy?: false | number;
  /** Send Strict-Transport-Security (only when served over HTTPS). */
  hsts?: boolean;
}

/** Trust exactly N proxy hops (closest first) for X-Forwarded-For; false trusts none. */
function trustHops(hops: false | number) {
  return hops === false ? false : (_addr: string, hop: number) => hop < hops;
}

/** Headers added to every response unless a route already set them. */
export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

const PUBLIC_ROUTES = new Set(['/api/health', '/api/auth/login']);
const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'threads', 'gbp', 'youtube'] as const;
const LOCALE = z.enum(['en', 'ms']);
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const IdParam = z.object({ id: z.uuid() });
const StaffParam = z.object({ id: z.string().regex(/^[a-z][a-z0-9_-]{0,40}$/) });

const human = (req: FastifyRequest): Actor => ({ kind: 'human', userId: req.user!.id });
function requireOwner(req: FastifyRequest) {
  if (req.user?.role !== 'owner') throw new PolicyError('forbidden', 'Only AIN (owner) can do this');
}

function statusFor(code: string) {
  if (code === 'not_found') return 404;
  if (code === 'file_too_large') return 413;
  if (code === 'unsupported_file' || code === 'file_type_mismatch') return 415;
  if (code === 'upload_failed') return 400;
  if (['forbidden', 'self_approval', 'human_only_check'].includes(code)) return 403;
  if (['invalid_input', 'unknown_template', 'invalid_stage', 'bad_duration', 'unknown_command', 'evidence_required'].includes(code)) return 400;
  return 409;
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.vtt': 'text/vtt', '.srt': 'text/plain; charset=utf-8',
};

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { db } = opts;
  const hub = opts.hub ?? null;
  const secure = opts.secureCookies ?? false;
  const assetsDir = resolve(opts.assetsDir ?? resolve(process.cwd(), 'assets'));
  const throttle = new LoginThrottle();
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 1_000_000, trustProxy: trustHops(opts.trustProxy ?? false) });

  // ---------- Security headers ----------
  app.addHook('onSend', async (req, reply, payload) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!reply.hasHeader(k)) reply.header(k, v);
    if (opts.hsts) reply.header('strict-transport-security', 'max-age=15552000; includeSubDomains');
    return payload;
  });

  // ---------- Cross-site request protection ----------
  // Browsers cannot add custom headers to cross-site requests without a CORS preflight, and CORS is not enabled.
  app.addHook('onRequest', async (req, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    if (!req.url.startsWith('/api/')) return;
    // Worker calls use a bearer token, not cookies, so they cannot be forged cross-site.
    if (req.url.startsWith('/api/worker/')) return;
    if (req.headers['x-candy-request'] !== '1') {
      return reply.code(403).send({ error: 'csrf', message: 'Missing x-candy-request header' });
    }
  });

  // ---------- Authentication ----------
  app.addHook('preHandler', async (req, reply) => {
    const route = req.routeOptions.url ?? '';
    if (!route.startsWith('/api/') || PUBLIC_ROUTES.has(route) || route.startsWith('/api/worker/')) return;
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const user = await userForToken(db, token);
    if (!user) return reply.code(401).send({ error: 'unauthenticated', message: 'Please sign in' });
    req.user = user; req.sessionToken = token;
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof PolicyError) return reply.code(statusFor(err.code)).send({ error: err.code, message: err.message });
    if (err instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_input', message: 'Some fields are missing or invalid', issues: err.issues });
    if (err?.code === '22P02' || err?.code === '23503') return reply.code(400).send({ error: 'invalid_input', message: 'A referenced record does not exist or an id is malformed' });
    if (err?.code === '23505') return reply.code(409).send({ error: 'conflict', message: 'That record already exists' });
    if (typeof err?.statusCode === 'number' && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'bad_request', message: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'server_error', message: 'The server hit an error and the action did not complete.' });
  });

  // ---------- Health (public) ----------
  app.get('/api/health', async () => {
    const dbOk = await db.query('SELECT 1').then(() => true, () => false);
    return { ok: dbOk, db: dbOk, stream: hub?.connected ?? false, my_date: myDate(), now: new Date().toISOString() };
  });

  // ---------- Auth ----------
  app.post('/api/auth/login', async (req, reply) => {
    const body = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(500) }).parse(req.body);
    const wait = throttle.blocked(body.email, req.ip);
    if (wait) return reply.code(429).send({ error: 'too_many_attempts', message: 'Too many failed sign-ins. Try again later.', retry_after_s: Math.ceil(wait / 1000) });
    const res = await login(db, body.email, body.password, req.headers['user-agent']);
    if (!res) {
      throttle.fail(body.email, req.ip);
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Email or password is incorrect' });
    }
    throttle.succeed(body.email, req.ip);
    reply.header('set-cookie', sessionCookie(res.token, secure));
    return { user: res.user };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await logout(db, req.sessionToken!, req.user!.id);
    reply.header('set-cookie', clearedCookie(secure));
    return { ok: true };
  });

  app.get('/api/me', async (req) => ({ user: req.user }));

  app.patch('/api/me/preferences', async (req) => {
    const b = z.object({ interfaceLocale: LOCALE.optional(), contentLocale: LOCALE.optional(), onboardingDone: z.boolean().optional() }).strict().parse(req.body);
    return tx(db, async (c) => {
      const r = await c.query(
        `UPDATE users SET interface_locale=coalesce($2, interface_locale), content_locale=coalesce($3, content_locale),
                          onboarding_done=coalesce($4, onboarding_done)
          WHERE id=$1 RETURNING id, email, display_name, role, interface_locale, content_locale, onboarding_done`,
        [req.user!.id, b.interfaceLocale ?? null, b.contentLocale ?? null, b.onboardingDone ?? null]);
      // Language changes affect new UI and new content only; nothing existing is rewritten or republished.
      if (b.interfaceLocale || b.contentLocale) await emit(c, human(req), 'settings.language_changed', { data: { interface_locale: b.interfaceLocale, content_locale: b.contentLocale } });
      return { user: r.rows[0] };
    });
  });

  app.post('/api/me/password', async (req, reply) => {
    const b = z.object({ current: z.string().min(1), next: z.string().min(12).max(500) }).parse(req.body);
    const row = (await db.query(`SELECT password_hash FROM users WHERE id=$1`, [req.user!.id])).rows[0];
    if (!(await verify(row.password_hash, b.current).catch(() => false))) return reply.code(401).send({ error: 'invalid_credentials', message: 'Current password is incorrect' });
    await setPassword(db, req.user!.id, b.next);   // signs out every session
    await tx(db, (c) => emit(c, human(req), 'auth.password_changed'));
    const res = await login(db, req.user!.email, b.next, req.headers['user-agent']);
    reply.header('set-cookie', sessionCookie(res!.token, secure));
    return { ok: true };
  });

  // ---------- Overview ----------
  app.get('/api/overview', async () => {
    const today = myDate();
    const [deleg, awaiting, questions, blocked, paused, worker, mode] = await Promise.all([
      db.query(`SELECT id, scope, expires_at, include_pending, starts_at,
                       (SELECT count(*)::int FROM approvals a WHERE a.delegation_id=d.id) AS approved_count
                  FROM delegation_sessions d WHERE revoked_at IS NULL AND expires_at > now()`),
      db.query(`SELECT kind, count(*)::int AS n FROM review_requests WHERE status='awaiting_ain' GROUP BY kind`),
      db.query(`SELECT count(*)::int AS n FROM questions WHERE answer IS NULL`),
      db.query(`SELECT id, ref, title, side_state, blocker, owner_staff FROM tasks WHERE side_state IS NOT NULL ORDER BY updated_at DESC LIMIT 20`),
      db.query(`SELECT value FROM app_settings WHERE key='publishing_paused'`),
      db.query(`SELECT max(heartbeat_at) AS last_heartbeat, count(*) FILTER (WHERE status='running' AND heartbeat_at > now() - interval '2 minutes')::int AS running
                  FROM tool_jobs`),
      db.query(`SELECT value FROM app_settings WHERE key='mode'`),
    ]);
    const d = deleg.rows[0] ?? null;
    const w = worker.rows[0];
    const session = await workerStatus(db);
    return {
      my_date: today,
      now: new Date().toISOString(),
      app_mode: mode.rows[0]?.value ?? 'connected',
      approval_mode: d ? 'delegated' : 'manual',
      delegation: d,
      awaiting_ain: Object.fromEntries(awaiting.rows.map((r) => [r.kind, r.n])),
      open_questions: questions.rows[0].n,
      blocked_tasks: blocked.rows,
      publishing_paused: paused.rows[0]?.value === true,
      // Honest worker state: staff work only runs while a Claude session or scheduled task is picking up jobs.
      staff_execution: {
        state: w.running > 0 || session.online ? 'active' : 'offline', running_jobs: w.running,
        last_heartbeat: session.last_seen ?? w.last_heartbeat, claude_session_online: session.online,
      },
      counters: await dailyCounters(db, today),
    };
  });

  // ---------- Staff ----------
  app.get('/api/staff', async () => {
    const r = await db.query(
      `SELECT s.*, (SELECT max(version) FROM staff_instructions i WHERE i.staff_id=s.id) AS instruction_version,
              (SELECT count(*)::int FROM tasks t WHERE t.owner_staff=s.id AND t.stage NOT IN ('published','performance_review','released_verified')) AS open_tasks,
              (SELECT count(*)::int FROM questions q WHERE q.staff_id=s.id AND q.answer IS NULL) AS open_questions
         FROM staff s ORDER BY s.sort_order`);
    return { staff: r.rows };
  });

  app.get('/api/staff/:id', async (req, reply) => {
    const { id } = StaffParam.parse(req.params);
    const s = (await db.query(`SELECT * FROM staff WHERE id=$1`, [id])).rows[0];
    if (!s) return reply.code(404).send({ error: 'not_found', message: 'Staff member not found' });
    const c = await db.connect();
    try {
      const [instructions, tasks, questions, jobs, proposals, reports] = await Promise.all([
        currentInstructions(c, id),
        db.query(`SELECT id, ref, title, stage, side_state, blocker, template, updated_at FROM tasks WHERE owner_staff=$1 OR $1 = ANY(collaborators) ORDER BY updated_at DESC LIMIT 50`, [id]),
        db.query(`SELECT * FROM questions WHERE staff_id=$1 ORDER BY created_at DESC LIMIT 50`, [id]),
        db.query(`SELECT * FROM tool_jobs WHERE staff_id=$1 ORDER BY created_at DESC LIMIT 20`, [id]),
        db.query(`SELECT * FROM memory_proposals WHERE staff_id=$1 ORDER BY created_at DESC LIMIT 20`, [id]),
        db.query(`SELECT id, display_name, role_title FROM staff WHERE reports_to=$1 ORDER BY sort_order`, [id]),
      ]);
      return { staff: s, instructions, tasks: tasks.rows, questions: questions.rows, tool_jobs: jobs.rows, memory_proposals: proposals.rows, direct_reports: reports.rows };
    } finally { c.release(); }
  });

  app.patch('/api/staff/:id', async (req, reply) => {
    requireOwner(req);
    const { id } = StaffParam.parse(req.params);
    const b = z.object({
      displayName: z.string().min(1).max(60).optional(), roleTitle: z.string().min(1).max(120).optional(),
      avatar: z.record(z.string(), z.unknown()).optional(), paused: z.boolean().optional(),
    }).strict().parse(req.body);
    return tx(db, async (c) => {
      const r = await c.query(
        `UPDATE staff SET display_name=coalesce($2,display_name), role_title=coalesce($3,role_title), avatar=coalesce($4,avatar),
                          paused=coalesce($5,paused), updated_at=now() WHERE id=$1 RETURNING *`,
        [id, b.displayName ?? null, b.roleTitle ?? null, b.avatar ?? null, b.paused ?? null]);
      if (!r.rowCount) return reply.code(404).send({ error: 'not_found', message: 'Staff member not found' });
      await emit(c, human(req), b.paused === undefined ? 'staff.updated' : b.paused ? 'staff.paused' : 'staff.resumed', { target: id, data: { fields: Object.keys(b) } });
      return { staff: r.rows[0] };
    });
  });

  app.post('/api/staff/brief', async (req) => {
    requireOwner(req);
    const b = z.object({
      staffId: z.string().optional(), department: z.string().optional(), all: z.boolean().optional(),
      body: z.string().min(1).max(20_000), changeNote: z.string().max(500).optional(),
    }).refine((x) => [x.staffId, x.department, x.all].filter(Boolean).length === 1, 'Choose exactly one of staffId, department, or all').parse(req.body);
    const out = await tx(db, (c) => briefStaff(c, req.user!.id, { staffId: b.staffId, department: b.department, all: b.all }, b.body, b.changeNote));
    return { instructions: out };
  });

  // ---------- Tasks ----------
  app.get('/api/tasks', async (req) => {
    const q = z.object({
      stage: z.string().optional(), owner: z.string().optional(), kind: z.enum(['content', 'design_dev']).optional(),
      state: z.enum(['open', 'blocked', 'all']).default('all'), demo: z.enum(['true', 'false']).optional(),
    }).parse(req.query);
    const r = await db.query(
      `SELECT t.*, s.display_name AS owner_name FROM tasks t LEFT JOIN staff s ON s.id=t.owner_staff
        WHERE ($1::text IS NULL OR t.stage=$1) AND ($2::text IS NULL OR t.owner_staff=$2) AND ($3::text IS NULL OR t.kind=$3)
          AND ($4 = 'all' OR ($4 = 'blocked' AND t.side_state IS NOT NULL)
               OR ($4 = 'open' AND t.stage NOT IN ('published','performance_review','released_verified')))
          AND ($5::boolean IS NULL OR t.is_demo=$5)
        ORDER BY t.updated_at DESC LIMIT 300`,
      [q.stage ?? null, q.owner ?? null, q.kind ?? null, q.state, q.demo === undefined ? null : q.demo === 'true']);
    return { tasks: r.rows };
  });

  app.get('/api/templates', async () => ({ templates: Object.entries(TEMPLATES).map(([id, t]) => ({ id, ...t })) }));

  app.post('/api/tasks', async (req) => {
    requireOwner(req);
    const b = z.object({
      template: z.string().refine((t) => t in TEMPLATES, 'Unknown template'),
      title: z.string().min(1).max(200), objective: z.string().max(5000).optional(), owner: z.string().optional(),
      platforms: z.array(z.enum(PLATFORMS)).max(6).optional(), audience: z.string().max(500).optional(),
      contentLocale: LOCALE.nullable().optional(), requiresClinical: z.boolean().optional(), requiresConsent: z.boolean().optional(),
      campaignId: z.uuid().optional(),
    }).strict().parse(req.body);
    const t = await tx(db, (c) => createTask(c, human(req), b));
    return { task: t };
  });

  app.get('/api/tasks/:id', async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    const t = (await db.query(`SELECT t.*, s.display_name AS owner_name FROM tasks t LEFT JOIN staff s ON s.id=t.owner_staff WHERE t.id=$1`, [id])).rows[0];
    if (!t) return reply.code(404).send({ error: 'not_found', message: 'Task not found' });
    const versions = (await db.query(`SELECT * FROM deliverable_versions WHERE task_id=$1 ORDER BY platform NULLS FIRST, version DESC`, [id])).rows;
    const ids = versions.map((v) => v.id);
    const [checks, approvals, reviews, questions, deps, events, posts] = await Promise.all([
      db.query(`SELECT * FROM checks WHERE version_id = ANY($1::uuid[]) ORDER BY created_at`, [ids]),
      db.query(`SELECT * FROM approvals WHERE version_id = ANY($1::uuid[]) ORDER BY created_at`, [ids]),
      db.query(`SELECT * FROM review_requests WHERE task_id=$1 ORDER BY submitted_at`, [id]),
      db.query(`SELECT * FROM questions WHERE task_id=$1 ORDER BY created_at`, [id]),
      db.query(`SELECT t.id, t.ref, t.title, t.stage FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on WHERE d.task_id=$1`, [id]),
      db.query(`SELECT ${EVENT_COLS} FROM events WHERE task_id=$1 ORDER BY seq DESC LIMIT 200`, [id]),
      db.query(`SELECT * FROM platform_posts WHERE task_id=$1 ORDER BY slot_at`, [id]),
    ]);
    const c = await db.connect();
    try {
      const enriched = [];
      for (const v of versions) enriched.push({ ...v, checks: checks.rows.filter((k) => k.version_id === v.id), missing_gates: await missingGates(c, v.id) });
      return {
        task: t, steps: TEMPLATES[t.template]?.steps ?? [], versions: enriched, approvals: approvals.rows, reviews: reviews.rows,
        questions: questions.rows, dependencies: deps.rows, events: events.rows, posts: posts.rows,
      };
    } finally { c.release(); }
  });

  app.post('/api/tasks/:id/advance', async (req) => {
    requireOwner(req);
    const { id } = IdParam.parse(req.params);
    const b = z.object({ toStage: z.string().min(1) }).parse(req.body);
    await tx(db, (c) => advanceTask(c, human(req), id, b.toStage));
    return { ok: true };
  });

  app.post('/api/tasks/:id/versions', async (req) => {
    requireOwner(req);
    const { id } = IdParam.parse(req.params);
    const b = z.object({
      platform: z.enum(PLATFORMS).nullable().optional(), copy: z.string().max(20_000).optional(),
      assets: z.array(z.string().max(500)).max(50).optional(), destination: z.string().max(200).optional(), locale: LOCALE.optional(),
    }).strict().parse(req.body);
    const v = await tx(db, (c) => createVersion(c, human(req), { taskId: id, ...b }));
    return { version: v };
  });

  app.post('/api/versions/:id/translate', async (req) => {
    requireOwner(req);
    const { id } = IdParam.parse(req.params);
    const b = z.object({ toLocale: LOCALE, copy: z.string().min(1).max(20_000) }).parse(req.body);
    const v = await tx(db, (c) => requestTranslation(c, human(req), id, b.toLocale, b.copy));
    return { version: v };
  });

  app.post('/api/versions/:id/checks', async (req) => {
    const { id } = IdParam.parse(req.params);
    const b = z.object({
      checkType: z.string().regex(/^[a-z_]{2,40}$/), result: z.enum(['passed', 'failed', 'not_verified']), evidence: z.string().max(5000).optional(),
    }).parse(req.body);
    await tx(db, (c) => recordCheck(c, human(req), id, b.checkType, b.result, b.evidence));
    return { ok: true };
  });

  // ---------- Daily review requests (CPR / DPR) ----------
  app.get('/api/reviews', async (req) => {
    const q = z.object({ date: DAY.optional(), kind: z.enum(['CPR', 'DPR']).optional() }).parse(req.query);
    const day = q.date ?? myDate();
    return { date: day, reviews: await dailyPrList(db, day, q.kind) };
  });

  app.get('/api/reviews/export', async (req, reply) => {
    const q = z.object({ date: DAY.optional(), kind: z.enum(['CPR', 'DPR']).optional(), format: z.enum(['csv', 'json']).default('csv') }).parse(req.query);
    const day = q.date ?? myDate();
    const rows = await dailyPrList(db, day, q.kind);
    const name = `candy-${q.kind ?? 'all'}-${day}.${q.format}`;
    reply.header('content-disposition', `attachment; filename="${name}"`);
    if (q.format === 'json') return reply.type('application/json').send(JSON.stringify({ date: day, reviews: rows }, null, 2));
    return reply.type('text/csv; charset=utf-8').send(toCsv(rows));
  });

  app.get('/api/reviews/awaiting', async () => {
    const r = await db.query(
      `SELECT rr.*, t.title, t.ref AS task_ref, t.template, t.kind AS task_kind, t.stage AS task_stage, t.platforms, t.is_demo, t.requires_clinical, t.requires_consent, v.version, v.platform, v.copy_text, v.asset_keys,
              v.destination, v.content_locale, v.content_hash, s.display_name AS submitted_by_name
         FROM review_requests rr JOIN tasks t ON t.id=rr.task_id JOIN deliverable_versions v ON v.id=rr.version_id JOIN staff s ON s.id=rr.submitted_by
        WHERE rr.status='awaiting_ain' ORDER BY rr.submitted_at`);
    return { reviews: r.rows };
  });

  app.post('/api/reviews/:id/decision', async (req) => {
    const { id } = IdParam.parse(req.params);
    const b = z.object({
      action: z.enum(['internal_approval', 'schedule', 'publish', 'reply', 'design_approval', 'implement', 'release']),
      decision: z.enum(['approved', 'changes_requested', 'rejected']),
      reason: z.string().max(5000).optional(),
    }).refine((x) => x.decision === 'approved' || !!x.reason?.trim(), 'Give a reason when requesting changes or rejecting').parse(req.body);
    const res = await decide(db, { reviewId: id, action: b.action, decision: b.decision, decider: { kind: 'human', userId: req.user!.id }, reason: b.reason });
    return res;
  });

  // ---------- Questions ----------
  app.get('/api/questions/digest', async () => {
    const c = await db.connect();
    try { return { digest: await questionDigest(c) }; } finally { c.release(); }
  });

  app.post('/api/questions/:id/answer', async (req) => {
    requireOwner(req);
    const { id } = IdParam.parse(req.params);
    const b = z.object({ answer: z.string().min(1).max(5000) }).parse(req.body);
    const q = await tx(db, (c) => answerQuestion(c, req.user!.id, id, b.answer));
    return { question: q };
  });

  // ---------- Delegation: BECOME ME / I'M DONE ----------
  const ScopeSchema = z.object({
    actions: z.array(z.enum(DELEGABLE_ACTIONS)).min(1),
    platforms: z.array(z.enum(PLATFORMS)),
    templates: z.array(z.string().refine((t) => t in TEMPLATES, 'Unknown template')),
    campaignIds: z.array(z.uuid()).optional(),
  }).strict();

  app.get('/api/delegation', async () => {
    const active = (await db.query(
      `SELECT d.*, (SELECT count(*)::int FROM approvals a WHERE a.delegation_id=d.id) AS approved_count
         FROM delegation_sessions d WHERE revoked_at IS NULL AND expires_at > now()`)).rows[0] ?? null;
    const recent = (await db.query(`SELECT * FROM delegation_sessions ORDER BY starts_at DESC LIMIT 20`)).rows;
    const unacknowledged = recent.filter((s) => s.revoked_at && !s.briefing_acknowledged_at).map((s) => s.id);
    return {
      mode: active ? 'delegated' : 'manual', active, recent, unacknowledged_briefings: unacknowledged,
      policy_version: POLICY_VERSION, delegable_actions: DELEGABLE_ACTIONS,
      never_delegable: ['production deployment', 'destructive migration', 'paid spend', 'credential or access changes', 'new clinical claims', 'unverified price or promotion changes'],
    };
  });

  app.post('/api/delegation/activate', async (req) => {
    const b = z.object({
      scope: ScopeSchema, minutes: z.number().int(), includePending: z.boolean(), confirmed: z.literal(true),
      source: z.enum(['button', 'command_input']).default('button'),
    }).parse(req.body);
    const s = await activateDelegation(db, { userId: req.user!.id, scope: b.scope, minutes: b.minutes, includePending: b.includePending, confirmed: b.confirmed, source: b.source });
    return { delegation: s };
  });

  app.post('/api/delegation/end', async (req) => {
    const b = z.object({ reason: z.enum(['im_done', 'stop']).default('im_done') }).parse(req.body ?? {});
    const s = await endDelegation(db, req.user!.id, b.reason);
    return { ended: s, briefing: s ? await returnBriefing(db, s.id) : null };
  });

  app.get('/api/delegation/:id/briefing', async (req) => {
    const { id } = IdParam.parse(req.params);
    const b = await returnBriefing(db, id);
    if (!b.session) throw new PolicyError('not_found', 'Delegation session not found');
    return { briefing: b };
  });

  app.post('/api/delegation/:id/acknowledge', async (req) => {
    requireOwner(req);
    const { id } = IdParam.parse(req.params);
    await acknowledgeBriefing(db, req.user!.id, id);
    return { ok: true };
  });

  /**
   * Authenticated command input. Only the exact phrases are recognised, typed by the signed-in owner.
   * BECOME ME never activates anything by itself: it opens the scope panel, which needs explicit confirmation.
   */
  app.post('/api/commands', async (req) => {
    requireOwner(req);
    const b = z.object({ text: z.string().max(100) }).parse(req.body);
    const norm = b.text.trim().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').toUpperCase();
    if (norm === 'BECOME ME') return { command: 'become_me', next: 'open_delegation_panel' };
    if (norm === "I'M DONE" || norm === 'IM DONE') {
      const s = await endDelegation(db, req.user!.id, 'im_done');
      return { command: 'im_done', ended: s, briefing: s ? await returnBriefing(db, s.id) : null };
    }
    throw new PolicyError('unknown_command', 'Recognised commands: BECOME ME, I\'M DONE');
  });

  // ---------- Publishing safety & targets ----------
  app.post('/api/publishing/pause', async (req) => {
    requireOwner(req);
    const b = z.object({ paused: z.boolean() }).parse(req.body);
    await setPublishingPaused(db, req.user!.id, b.paused);
    return { paused: b.paused };
  });

  app.get('/api/counters', async (req) => {
    const q = z.object({ date: DAY.optional() }).parse(req.query);
    const day = q.date ?? myDate();
    return { date: day, core_platforms: CORE_PLATFORMS, counters: await dailyCounters(db, day) };
  });

  app.get('/api/posts', async (req) => {
    const q = z.object({ date: DAY.optional() }).parse(req.query);
    const day = q.date ?? myDate();
    const r = await db.query(
      `SELECT p.*, t.ref AS task_ref, t.title FROM platform_posts p JOIN tasks t ON t.id=p.task_id WHERE p.my_date=$1 ORDER BY p.slot_at, p.platform`, [day]);
    return { date: day, posts: r.rows };
  });

  app.get('/api/targets', async () => ({ targets: (await db.query(`SELECT * FROM daily_targets ORDER BY platform`)).rows }));

  app.put('/api/targets/:platform', async (req) => {
    requireOwner(req);
    const { platform } = z.object({ platform: z.enum(PLATFORMS) }).parse(req.params);
    const b = z.object({
      feedTarget: z.number().int().min(0).max(20), storyTarget: z.number().int().min(0).max(20),
      storiesCountTowardFeed: z.boolean(), slots: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(12),
    }).strict().parse(req.body);
    return tx(db, async (c) => {
      const r = await c.query(
        `INSERT INTO daily_targets (platform, feed_target, story_target, stories_count_toward_feed, slots) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (platform) DO UPDATE SET feed_target=$2, story_target=$3, stories_count_toward_feed=$4, slots=$5 RETURNING *`,
        [platform, b.feedTarget, b.storyTarget, b.storiesCountTowardFeed, [...new Set(b.slots)].sort()]);
      await emit(c, human(req), 'settings.targets_changed', { target: platform, data: b });
      return { target: r.rows[0] };
    });
  });

  // ---------- Integrations (never exposes secrets) ----------
  app.get('/api/connections', async () => ({
    connections: (await db.query(`SELECT id, status, capabilities, last_check_at, last_error, (secret_ciphertext IS NOT NULL) AS has_secret FROM connections ORDER BY id`)).rows,
  }));

  // ---------- Activity log ----------
  app.get('/api/events', async (req) => {
    const q = z.object({
      before: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(500).default(100),
      type: z.string().max(60).optional(), taskId: z.uuid().optional(), delegationId: z.uuid().optional(),
    }).parse(req.query);
    const r = await db.query(
      `SELECT ${EVENT_COLS} FROM events
        WHERE ($1::bigint IS NULL OR seq < $1) AND ($2::text IS NULL OR type LIKE $2 || '%') AND ($3::uuid IS NULL OR task_id=$3)
          AND ($4::text IS NULL OR data->>'delegation_id'=$4 OR target=$4)
        ORDER BY seq DESC LIMIT $5`,
      [q.before ?? null, q.type ?? null, q.taskId ?? null, q.delegationId ?? null, q.limit]);
    const rows = r.rows as EventRow[];
    return { events: rows, next_before: rows.length === q.limit ? rows[rows.length - 1].seq : null };
  });

  // ---------- Live event stream (SSE) with replay ----------
  app.get('/api/events/stream', async (req, reply) => {
    if (!hub) return reply.code(503).send({ error: 'stream_unavailable', message: 'Live updates are not running on this server' });
    const q = z.object({ after: z.coerce.number().int().min(0).optional() }).parse(req.query);
    const header = req.headers['last-event-id'];
    const lastId = typeof header === 'string' && /^\d+$/.test(header) ? Number(header) : q.after;
    const token = req.sessionToken!;

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive', 'x-accel-buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    const send = (e: EventRow) => { res.write(`id: ${e.seq}\nevent: candy\ndata: ${JSON.stringify(e)}\n\n`); };

    // Buffer live events while replaying so nothing falls between replay and live.
    let replaying = lastId !== undefined;
    const queued: EventRow[] = [];
    const sent = new Set<string>();
    const unsubscribe = hub.subscribe((e) => {
      if (replaying) { queued.push(e); return; }
      if (!sent.has(e.seq)) { sent.add(e.seq); send(e); }
      if (sent.size > 5000) sent.clear();
    });

    let closed = false;
    const heartbeat = setInterval(async () => {
      // Re-check the session so signing out (or expiry) also ends open streams.
      if (!(await userForToken(db, token).catch(() => null))) { res.write('event: session_ended\ndata: {}\n\n'); cleanup(); res.end(); return; }
      res.write(`: ping ${Date.now()}\n\n`);
    }, opts.streamHeartbeatMs ?? 20_000);
    const cleanup = () => { if (closed) return; closed = true; clearInterval(heartbeat); unsubscribe(); };
    req.raw.on('close', cleanup);

    if (lastId !== undefined) {
      try {
        const rows = await hub.replay(lastId);
        for (const e of rows) { sent.add(e.seq); send(e); }
        res.write(`event: replay_done\ndata: ${JSON.stringify({ count: rows.length })}\n\n`);
      } catch {
        res.write(`event: replay_failed\ndata: {}\n\n`);
      }
      replaying = false;
      for (const e of queued) if (!sent.has(e.seq)) { sent.add(e.seq); send(e); }
      queued.length = 0;
    } else {
      res.write(`event: ready\ndata: {}\n\n`);
    }
  });

  // ---------- Private assets (posters, exports) ----------
  app.get('/api/assets/*', async (req, reply) => {
    const rel = (req.params as { '*': string })['*'];
    const full = resolve(assetsDir, rel);
    if (!full.startsWith(assetsDir + sep) || !MIME[extname(full).toLowerCase()] || !existsSync(full) || !statSync(full).isFile()) {
      return reply.code(404).send({ error: 'not_found', message: 'Asset not found' });
    }
    reply.header('cache-control', 'private, max-age=300');
    reply.header('x-content-type-options', 'nosniff');
    return reply.type(MIME[extname(full).toLowerCase()]).send(createReadStream(full));
  });

  // ---------- Head chat, staff sub-chats, decisions log, worker access ----------
  registerChatRoutes(app, { db, workerToken: opts.workerToken ?? null });

  // ---------- Staff training uploads (images, videos, zip) ----------
  registerUploadRoutes(app, { db, storageDir: opts.storageDir ?? resolve(process.cwd(), 'storage'), maxBytes: opts.maxUploadBytes ?? 500 * 1024 * 1024 });

  // ---------- Asset library: every file referenced by a deliverable version ----------
  app.get('/api/library', async () => {
    const r = await db.query(
      `SELECT a.key, v.id AS version_id, v.version, v.platform, v.content_locale, v.created_at, t.id AS task_id, t.ref AS task_ref, t.title, t.is_demo,
              (SELECT rr.status FROM review_requests rr WHERE rr.version_id=v.id ORDER BY rr.submitted_at DESC LIMIT 1) AS review_status
         FROM deliverable_versions v JOIN tasks t ON t.id=v.task_id, unnest(v.asset_keys) AS a(key)
        ORDER BY v.created_at DESC LIMIT 500`);
    return {
      assets: r.rows.map((x) => {
        const rel = String(x.key).replace(/^assets\//, '');
        const full = resolve(assetsDir, rel);
        const available = full.startsWith(assetsDir + sep) && existsSync(full) && !!MIME[extname(full).toLowerCase()];
        return { ...x, url: available ? `/api/assets/${rel}` : null, available, mime: MIME[extname(full).toLowerCase()] ?? null };
      }),
    };
  });

  // ---------- Built web app (web/dist) ----------
  const webDir = opts.webDir ? resolve(opts.webDir) : null;
  app.get('/*', async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found', message: 'Unknown API route' });
    if (!webDir || !existsSync(join(webDir, 'index.html'))) {
      return reply.code(404).type('text/plain; charset=utf-8').send('The web app has not been built yet. Run: corepack pnpm build:web');
    }
    const rel = decodeURIComponent((req.params as { '*': string })['*'] || 'index.html');
    let full = resolve(webDir, rel);
    if (!full.startsWith(webDir + sep) || !existsSync(full) || !statSync(full).isFile()) full = join(webDir, 'index.html');
    const ext = extname(full).toLowerCase();
    const type = WEB_MIME[ext] ?? MIME[ext] ?? 'application/octet-stream';
    reply.header('x-content-type-options', 'nosniff');
    reply.header('cache-control', full.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (ext === '.html') reply.header('content-security-policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    return reply.type(type).send(createReadStream(full));
  });

  return app;
}

const WEB_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

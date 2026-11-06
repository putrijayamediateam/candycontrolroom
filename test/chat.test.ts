import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createPool, type Db } from '../src/server/db/pool.js';
import { migrate } from '../src/server/db/migrate.js';
import { seedBase, createUser } from '../src/server/db/seed.js';
import { buildApp } from '../src/server/app.js';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/candy_test';
const TOKEN = 'test-worker-token-0123456789abcdef';
let db: Db; let app: FastifyInstance; let owner = ''; let reviewer = '';

const own = async (method: string, url: string, payload?: unknown, cookie = owner) => {
  const r = await app.inject({ method: method as any, url, headers: { cookie, 'x-candy-request': '1' }, ...(payload ? { payload: payload as any } : {}) });
  return { status: r.statusCode, json: r.json() };
};
const worker = async (method: string, url: string, payload?: unknown, token = TOKEN) => {
  const r = await app.inject({ method: method as any, url, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(payload ? { payload: payload as any } : {}) });
  return { status: r.statusCode, json: r.json() };
};

beforeAll(async () => {
  db = createPool(URL);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db); await seedBase(db);
  await createUser(db, 'owner@example.test', 'AIN', 'owner', 'owner-password-123');
  await createUser(db, 'rev@example.test', 'Reviewer', 'reviewer', 'reviewer-password-123');
  app = await buildApp({ db, workerToken: TOKEN });
  const login = async (email: string, password: string) => String((await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'x-candy-request': '1' }, payload: { email, password } })).headers['set-cookie']).split(';')[0];
  owner = await login('owner@example.test', 'owner-password-123');
  reviewer = await login('rev@example.test', 'reviewer-password-123');
});
afterAll(async () => { await app.close(); await db.end(); });

describe('CANDY head chat, staff sub-chats and decisions', () => {
  it('every one of the 21 staff has a chat, with CANDY first as head', async () => {
    const r = await own('GET', '/api/chat/threads');
    expect(r.json.threads).toHaveLength(21);
    expect(r.json.threads[0].id).toBe('candy');
    expect(r.json.worker.online).toBe(false);
  });

  it('starts the decisions log from docs/DECISIONS.md and lets AIN add decisions', async () => {
    const d = (await own('GET', '/api/decisions')).json.decisions;
    expect(d.length).toBeGreaterThanOrEqual(10);
    expect(d.some((x: any) => x.body.includes('Klinik Putrijaya Cheras'))).toBe(true);
    expect(d.find((x: any) => x.body.includes('Klinik Putrijaya Cheras')).decided_on).toBe('2026-11-06');
    expect((await own('POST', '/api/decisions', { body: 'x' }, reviewer)).status).toBe(403);
    const add = await own('POST', '/api/decisions', { body: 'Hari Raya posters use the soft pink background.' });
    expect(add.json.decision.source).toBe('Control Room');
  });

  it('AIN messages wait honestly until a Claude session answers', async () => {
    const m = await own('POST', '/api/chat/candy', { body: 'What is waiting for me today?' });
    expect(m.json.message).toMatchObject({ thread: 'candy', author_kind: 'human', delivery: 'waiting', kind: 'message' });
    expect((await own('POST', '/api/chat/candy', { body: 'x' }, reviewer)).status).toBe(403);
    const t = (await own('GET', '/api/chat/threads')).json.threads.find((x: any) => x.id === 'candy');
    expect(t.waiting).toBe(1);
  });

  it('orders through CANDY are only allowed from the head chat', async () => {
    expect((await own('POST', '/api/chat/mei', { body: 'x', routeTo: 'iman' })).status).toBe(400);
    const o = await own('POST', '/api/chat/candy', { body: 'Mei: make the flu price bigger.', routeTo: 'mei' });
    expect(o.json.message).toMatchObject({ kind: 'order', route_to: 'mei' });
  });

  it('the worker needs its token and cannot use AIN\'s routes', async () => {
    expect((await worker('GET', '/api/worker/inbox', undefined, '')).status).toBe(401);
    expect((await worker('GET', '/api/worker/inbox', undefined, 'wrong-token')).status).toBe(401);
    expect((await worker('GET', '/api/chat/threads')).status).toBe(401);
    expect((await worker('POST', '/api/reviews/00000000-0000-4000-8000-000000000000/decision', { action: 'internal_approval', decision: 'approved' })).status).toBe(403);
  });

  it('a Claude session picks up, relays the order, staff answers, CANDY confirms — all visible', async () => {
    const inbox = (await worker('GET', '/api/worker/inbox')).json;
    expect(inbox.pending).toHaveLength(2);
    const order = inbox.pending.find((m: any) => m.kind === 'order');
    expect(inbox.context.mei.staff.role_title).toBe('Graphic Designer');
    expect((await own('GET', '/api/chat/threads')).json.worker.online).toBe(true);
    expect((await worker('POST', '/api/worker/pickup', { ids: [order.id] })).json.picked_up).toBe(1);

    const relay = await worker('POST', '/api/worker/messages', { asStaff: 'candy', thread: 'mei', kind: 'relay', replyTo: order.id, body: 'Mei, AIN asks: make the flu price bigger.' });
    expect(relay.json.message.kind).toBe('relay');
    await worker('POST', '/api/worker/messages', { asStaff: 'mei', thread: 'mei', body: 'On it — I will submit v2 for review.' });
    await worker('POST', '/api/worker/messages', { asStaff: 'candy', thread: 'candy', replyTo: order.id, body: 'Passed to Mei. She is preparing v2.' });

    const head = (await own('GET', '/api/chat/candy')).json.messages;
    expect(head.find((m: any) => m.id === order.id).delivery).toBe('answered');
    const mei = (await own('GET', '/api/chat/mei')).json.messages.map((m: any) => m.author_id);
    expect(mei).toEqual(['candy', 'mei']);
    const monitor = (await own('GET', '/api/chat-monitor')).json.messages;
    expect(monitor.length).toBe(2);
    const jobs = (await db.query(`SELECT staff_id, evidence FROM tool_jobs ORDER BY created_at`)).rows;
    expect(jobs.every((j) => j.evidence === 'verified')).toBe(true);
    expect(jobs.map((j) => j.staff_id)).toEqual(['candy', 'mei', 'candy']);
  });

  it('staff cannot write in someone else\'s chat; only CANDY relays; paused staff cannot post', async () => {
    expect((await worker('POST', '/api/worker/messages', { asStaff: 'mei', thread: 'adam', body: 'x' })).status).toBe(403);
    expect((await worker('POST', '/api/worker/messages', { asStaff: 'mei', thread: 'mei', kind: 'relay', body: 'x' })).status).toBe(403);
    expect((await worker('POST', '/api/worker/messages', { asStaff: 'iman', thread: 'candy', body: 'Reporting to CANDY: captions drafted.' })).status).toBe(200);
    await own('PATCH', '/api/staff/arjun', { paused: true });
    expect((await worker('POST', '/api/worker/messages', { asStaff: 'arjun', thread: 'arjun', body: 'x' })).status).toBe(409);
  });

  it('opening a chat marks replies read', async () => {
    const before = (await own('GET', '/api/chat/threads')).json.threads.find((x: any) => x.id === 'mei');
    expect(before.unread).toBe(2);
    await own('POST', '/api/chat/mei/read');
    expect((await own('GET', '/api/chat/threads')).json.threads.find((x: any) => x.id === 'mei').unread).toBe(0);
  });

  it('without a configured token, worker access is off', async () => {
    const plain = await buildApp({ db });
    const r = await plain.inject({ method: 'GET', url: '/api/worker/inbox', headers: { authorization: `Bearer ${TOKEN}` } });
    expect(r.statusCode).toBe(503);
    await plain.close();
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { createPool, type Db } from '../src/server/db/pool.js';
import { migrate } from '../src/server/db/migrate.js';
import { seedBase, createUser } from '../src/server/db/seed.js';
import { buildApp } from '../src/server/app.js';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/candy_test';
const storage = mkdtempSync(join(tmpdir(), 'candy-storage-'));
let db: Db; let app: FastifyInstance; let owner = ''; let reviewer = '';

const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(200, 7)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(2000, 1)]);
const ZIP = Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.alloc(100, 2)]);
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 3)]);

async function upload(staff: string, name: string, body: Buffer, cookie = owner, extra: Record<string, string> = {}) {
  const r = await app.inject({
    method: 'POST', url: `/api/staff/${staff}/files`, payload: body,
    headers: { cookie, 'x-candy-request': '1', 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(name), ...extra },
  });
  return { status: r.statusCode, json: (() => { try { return r.json(); } catch { return null; } })() };
}
const get = (url: string, cookie = owner, headers: Record<string, string> = {}) => app.inject({ method: 'GET', url, headers: { cookie, ...headers } });
const filesOnDisk = (staff: string) => existsSync(join(storage, 'training', staff)) ? readdirSync(join(storage, 'training', staff)) : [];

beforeAll(async () => {
  db = createPool(URL);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db); await seedBase(db);
  await createUser(db, 'owner@example.test', 'AIN', 'owner', 'owner-password-123');
  await createUser(db, 'rev@example.test', 'Reviewer', 'reviewer', 'reviewer-password-123');
  app = await buildApp({ db, storageDir: storage, maxUploadBytes: 64 * 1024 });
  const login = async (email: string, password: string) => String((await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'x-candy-request': '1' }, payload: { email, password } })).headers['set-cookie']).split(';')[0];
  owner = await login('owner@example.test', 'owner-password-123');
  reviewer = await login('rev@example.test', 'reviewer-password-123');
});
afterAll(async () => { await app.close(); await db.end(); rmSync(storage, { recursive: true, force: true }); });

describe('staff training uploads', () => {
  it('requires a signed-in owner; nothing is written otherwise', async () => {
    expect((await upload('mei', 'a.png', PNG, '')).status).toBe(401);
    expect((await upload('mei', 'a.png', PNG, reviewer)).status).toBe(403);
    expect((await upload('nobody', 'a.png', PNG)).status).toBe(404);
    expect(filesOnDisk('mei')).toEqual([]);
  });

  it('accepts an image, lists it, and serves it privately and inline', async () => {
    const r = await upload('mei', 'Raya style.png', PNG, owner, { 'x-file-category': 'approved_example', 'x-file-note': encodeURIComponent('Use this pink') });
    expect(r.status).toBe(201);
    expect(r.json.file).toMatchObject({ original_name: 'Raya style.png', kind: 'image', category: 'approved_example', note: 'Use this pink', size_bytes: PNG.length });
    const list = (await get('/api/staff/mei/files')).json();
    expect(list.files).toHaveLength(1);
    const f = await get(list.files[0].url);
    expect(f.statusCode).toBe(200);
    expect(f.headers['content-type']).toBe('image/png');
    expect(f.headers['content-disposition']).toMatch(/^inline/);
    expect(f.headers['x-content-type-options']).toBe('nosniff');
    expect(String(f.headers['content-security-policy'])).toContain('sandbox');
    expect(f.rawPayload.equals(PNG)).toBe(true);
    expect((await get(list.files[0].url, '')).statusCode).toBe(401);
  });

  it('accepts video with byte ranges (so it can seek) and zip as a download', async () => {
    const v = await upload('farah', 'b-roll.mp4', MP4);
    expect(v.status).toBe(201);
    const part = await get(v.json.file.url, owner, { range: 'bytes=0-99' });
    expect(part.statusCode).toBe(206);
    expect(part.headers['content-range']).toBe(`bytes 0-99/${MP4.length}`);
    expect(part.rawPayload.length).toBe(100);
    const z = await upload('farah', 'footage pack.zip', ZIP);
    expect(z.status).toBe(201);
    expect((await get(z.json.file.url)).headers['content-disposition']).toMatch(/^attachment/);
  });

  it('rejects disallowed types, disguised files and oversized files, leaving nothing behind', async () => {
    expect((await upload('arjun', 'tool.exe', EXE)).json.error).toBe('unsupported_file');
    expect((await upload('arjun', 'logo.svg', Buffer.from('<svg onload="x"/>'))).json.error).toBe('unsupported_file');
    const fake = await upload('arjun', 'photo.png', EXE);
    expect(fake.status).toBe(415); expect(fake.json.error).toBe('file_type_mismatch');
    const big = await upload('arjun', 'big.mp4', Buffer.concat([MP4, Buffer.alloc(70 * 1024)]));
    expect(big.status).toBe(413);
    expect(filesOnDisk('arjun')).toEqual([]);
  });

  it('keeps only a safe display name; stored names are server ids', async () => {
    const r = await upload('chloe', '../../../etc/evil.png', PNG);
    expect(r.json.file.original_name).toBe('evil.png');
    expect(filesOnDisk('chloe')).toEqual([`${r.json.file.id}.png`]);
  });

  it('removing hides the file from training and logs it, without deleting it from storage', async () => {
    const r = await upload('nadia', 'old.png', PNG);
    const url = r.json.file.url;
    expect((await app.inject({ method: 'POST', url: `${url}/remove`, headers: { cookie: reviewer, 'x-candy-request': '1' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: `${url}/remove`, headers: { cookie: owner, 'x-candy-request': '1' } })).statusCode).toBe(200);
    expect((await get('/api/staff/nadia/files')).json().files).toHaveLength(0);
    expect((await get(url)).statusCode).toBe(404);
    expect(filesOnDisk('nadia')).toHaveLength(1);
    const ev = (await db.query(`SELECT type FROM events WHERE target='nadia' ORDER BY seq`)).rows.map((x) => x.type);
    expect(ev).toEqual(['staff.training_file_added', 'staff.training_file_removed']);
  });
});

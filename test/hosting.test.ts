import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { poolConfig, createPool } from '../src/server/db/pool.js';
import { serverConfig } from '../src/server/config.js';
import { syncMissingAssets } from '../src/server/assetSync.js';
import { buildApp, SECURITY_HEADERS } from '../src/server/app.js';

const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5433/candy_test';

describe('Postgres TLS for a hosted database', () => {
  it('local URLs stay plain', () => {
    expect(poolConfig('postgres://u:p@localhost:5433/candy')).toEqual({ connectionString: 'postgres://u:p@localhost:5433/candy' });
  });
  it('sslmode=require in the URL or PGSSLMODE turns on TLS, and the URL is cleaned', () => {
    const a = poolConfig('postgres://u:p@db.example:5432/candy?sslmode=require');
    expect(a.ssl).toEqual({ rejectUnauthorized: false });
    expect(a.connectionString).not.toContain('sslmode');
    expect(poolConfig('postgres://u:p@db.example/candy', { PGSSLMODE: 'require' }).ssl).toEqual({ rejectUnauthorized: false });
  });
  it('verify-full checks the certificate, with an optional CA', () => {
    expect(poolConfig('postgres://h/db', { PGSSLMODE: 'verify-full' }).ssl).toEqual({ rejectUnauthorized: true });
    expect(poolConfig('postgres://h/db', { PGSSLMODE: 'verify-full', PGSSLROOTCERT_PEM: 'PEM' }).ssl).toEqual({ rejectUnauthorized: true, ca: 'PEM' });
    expect(poolConfig('postgres://h/db?sslmode=disable').ssl).toBeUndefined();
    expect(() => poolConfig('postgres://h/db', { PGSSLMODE: 'sometimes' })).toThrow(/PGSSLMODE/);
  });
});

describe('server settings from the environment', () => {
  it('keeps the local defaults: 127.0.0.1:3100, no proxy trust, plain cookies', () => {
    const c = serverConfig({});
    expect(c).toMatchObject({ host: '127.0.0.1', port: 3100, secureCookies: false, hsts: false, trustProxy: false, storageDir: 'storage', assetsDir: 'assets', webDir: 'web/dist', problems: [] });
  });
  it('hosting: HOST, PORT, COOKIE_SECURE, TRUST_PROXY, STORAGE_DIR and ASSETS_DIR from env', () => {
    const c = serverConfig({ HOST: '0.0.0.0', PORT: '10000', COOKIE_SECURE: 'true', TRUST_PROXY: '1', STORAGE_DIR: '/data/storage', ASSETS_DIR: '/data/assets', WORKER_TOKEN: 'x'.repeat(40) });
    expect(c).toMatchObject({ host: '0.0.0.0', port: 10000, secureCookies: true, hsts: true, trustProxy: 1, storageDir: '/data/storage', assetsDir: '/data/assets', problems: [] });
    expect(serverConfig({ TRUST_PROXY: 'true' }).trustProxy).toBe(1);
  });
  it('refuses to listen publicly without HTTPS cookies or with a short worker token', () => {
    expect(serverConfig({ HOST: '0.0.0.0' }).problems.join(' ')).toMatch(/COOKIE_SECURE/);
    expect(serverConfig({ HOST: '0.0.0.0', COOKIE_SECURE: 'true', WORKER_TOKEN: 'short' }).problems.join(' ')).toMatch(/WORKER_TOKEN/);
    expect(() => serverConfig({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => serverConfig({ TRUST_PROXY: '99' })).toThrow(/TRUST_PROXY/);
  });
});

describe('assets on the host volume', () => {
  const root = mkdtempSync(join(tmpdir(), 'candy-assets-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  it('copies only missing files and never overwrites an existing asset', () => {
    const from = join(root, 'image'), to = join(root, 'volume');
    mkdirSync(join(from, 'posters'), { recursive: true });
    writeFileSync(join(from, 'posters', 'a.png'), 'from-image');
    writeFileSync(join(from, 'logo.png'), 'logo');
    mkdirSync(join(to, 'posters'), { recursive: true });
    writeFileSync(join(to, 'posters', 'a.png'), 'submitted-bytes');
    const copied = syncMissingAssets(from, to);
    expect(copied).toEqual(['logo.png']);
    expect(readFileSync(join(to, 'posters', 'a.png'), 'utf8')).toBe('submitted-bytes');
    expect(existsSync(join(to, 'logo.png'))).toBe(true);
    expect(syncMissingAssets(from, to)).toEqual([]);
    expect(syncMissingAssets(join(root, 'missing'), to)).toEqual([]);
  });
});

describe('HTTP hardening', () => {
  const db = createPool(TEST_URL);
  afterAll(async () => { await db.end(); });

  it('every response carries security headers; HSTS only behind HTTPS', async () => {
    const plain = await buildApp({ db });
    const r = await plain.inject({ url: '/api/health' });
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(r.headers[k], k).toBe(v);
    expect(r.headers['strict-transport-security']).toBeUndefined();
    await plain.close();
    const https = await buildApp({ db, hsts: true });
    expect((await https.inject({ url: '/api/health' })).headers['strict-transport-security']).toMatch(/max-age=/);
    await https.close();
  });

  it('health is public and shows no secrets or configuration', async () => {
    const app = await buildApp({ db, workerToken: 'w'.repeat(40) });
    const body = (await app.inject({ url: '/api/health' })).json();
    expect(Object.keys(body).sort()).toEqual(['db', 'my_date', 'now', 'ok', 'stream']);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('w'.repeat(10));
    expect(raw).not.toMatch(/postgres:|password|secret/i);
    await app.close();
  });

  it('behind one trusted proxy the login throttle sees the real client IP', async () => {
    const email = `throttle-${Date.now()}@example.test`;
    const login = (app: Awaited<ReturnType<typeof buildApp>>, ip: string) => app.inject({
      method: 'POST', url: '/api/auth/login', headers: { 'x-candy-request': '1', 'x-forwarded-for': ip }, payload: { email, password: 'wrong' } });
    const proxied = await buildApp({ db, trustProxy: 1 });
    for (let i = 0; i < 5; i++) expect((await login(proxied, '203.0.113.7')).statusCode).toBe(401);
    expect((await login(proxied, '203.0.113.7')).statusCode).toBe(429);
    expect((await login(proxied, '198.51.100.9')).statusCode).toBe(401); // a different person is not locked out
    await proxied.close();
    // Without proxy trust, a forged X-Forwarded-For cannot dodge the throttle.
    const direct = await buildApp({ db });
    for (let i = 0; i < 5; i++) await login(direct, `192.0.2.${i}`);
    expect((await login(direct, '192.0.2.99')).statusCode).toBe(429);
    await direct.close();
  });
});

describe('container and deploy files never ship secrets', () => {
  it('.dockerignore excludes .env, .local-* files, storage and worktrees', () => {
    const ignore = readFileSync('.dockerignore', 'utf8').split(/\r?\n/);
    for (const p of ['.env', '.local-*', 'storage/', '.claude/', '.git/']) expect(ignore, p).toContain(p);
  });
  it('the Dockerfile listens publicly only with HTTPS cookies, proxy trust and a /data volume', () => {
    const d = readFileSync('Dockerfile', 'utf8');
    for (const s of ['HOST=0.0.0.0', 'COOKIE_SECURE=true', 'TRUST_PROXY=1', 'STORAGE_DIR=/data/storage', 'ASSETS_DIR=/data/assets', 'USER node', '/api/health', 'build:web'])
      expect(d, s).toContain(s);
    expect(d).not.toMatch(/WORKER_TOKEN=|DATABASE_URL=|SESSION_SECRET=/);
  });
  it('render.yaml keeps secrets out of git and uses Singapore', () => {
    const r = readFileSync('render.yaml', 'utf8');
    expect(r).toContain('region: singapore');
    expect(r).toContain('healthCheckPath: /api/health');
    expect(r).toMatch(/key: WORKER_TOKEN[^\n]*\n\s+sync: false/);
    expect(r).not.toMatch(/value: .*(postgres:|[A-Za-z0-9_-]{30,})/);
  });
});

import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TEMPLATES } from '../src/server/core/workflow.js';
import { buildApp } from '../src/server/app.js';
import { createPool } from '../src/server/db/pool.js';

const en = JSON.parse(readFileSync('web/src/locales/en.json', 'utf8'));
const ms = JSON.parse(readFileSync('web/src/locales/ms.json', 'utf8'));

function flatten(o: Record<string, any>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(out, flatten(v, key));
    else out[key] = String(v);
  }
  return out;
}
function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(f) ? [p] : [];
  });
}
const EN = flatten(en); const MS = flatten(ms);
const webSrc = files('web/src', /\.tsx?$/).map((f) => readFileSync(f, 'utf8')).join('\n');
const serverSrc = files('src/server', /\.ts$/).map((f) => readFileSync(f, 'utf8')).join('\n');

describe('English and Malay localisation', () => {
  it('English and Malay have exactly the same keys, none empty', () => {
    expect(Object.keys(MS).sort()).toEqual(Object.keys(EN).sort());
    for (const [k, v] of Object.entries(MS)) expect(v.trim(), k).not.toBe('');
  });

  it('Malay is actually translated (not a copy of English)', () => {
    const same = Object.keys(EN).filter((k) => EN[k] === MS[k] && EN[k].length > 12 && !/^[A-Z' —/]+$/.test(EN[k]));
    // Brand and platform names may legitimately match; long sentences must not.
    expect(same.filter((k) => !k.startsWith('platform.') && !k.startsWith('integrations.')), same.join(', ')).toEqual([]);
  });

  it('every literal t("…") key used by the web app exists', () => {
    const used = [...webSrc.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)].map((m) => m[1]);
    const missing = [...new Set(used)].filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });

  it('every workflow stage, template and emitted event type has a label', () => {
    for (const [id, t] of Object.entries(TEMPLATES)) {
      expect(EN, `template.${id}`).toHaveProperty([`template.${id}`]);
      for (const s of t.steps) expect(EN, `stage.${s}`).toHaveProperty([`stage.${s}`]);
    }
    const emitted = new Set([...serverSrc.matchAll(/emit\([^,]+,\s*[^,]+,\s*'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]));
    emitted.add('approval.approved'); emitted.add('approval.changes_requested'); emitted.add('approval.rejected');
    const unlabeled = [...emitted].filter((ty) => !(`eventType.${ty}` in EN));
    expect(unlabeled).toEqual([]);
  });

  it('every server policy error code has a friendly message', () => {
    const codes = new Set([...serverSrc.matchAll(/PolicyError\('([a-z_]+)'/g)].map((m) => m[1]));
    const missing = [...codes].filter((c) => !(`errors.${c}` in EN));
    expect(missing).toEqual([]);
  });

  it('BECOME ME and I\'M DONE stay recognisable in both languages', () => {
    for (const L of [EN, MS]) {
      expect(L['delegation.becomeMe']).toBe('BECOME ME');
      expect(L['delegation.imDone']).toContain("I'M DONE");
      expect(L['command.placeholder']).toContain('BECOME ME');
    }
  });
});

describe('serving the built web app', () => {
  const dir = mkdtempSync(join(tmpdir(), 'candy-web-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>CANDY</title>');
  const db = createPool('postgres://unused@127.0.0.1:1/none');
  afterAll(async () => { rmSync(dir, { recursive: true, force: true }); await db.end(); });

  it('serves index.html with a CSP for app routes, and JSON 404 for unknown API routes', async () => {
    const app = await buildApp({ db, webDir: dir });
    const home = await app.inject({ url: '/' });
    expect(home.statusCode).toBe(200);
    expect(home.headers['content-type']).toContain('text/html');
    expect(String(home.headers['content-security-policy'])).toContain("default-src 'self'");
    expect((await app.inject({ url: '/anything/deep' })).body).toContain('<title>CANDY</title>');
    const api = await app.inject({ url: '/api/nope' });
    expect(api.statusCode).toBe(404);
    expect(api.json().error).toBe('not_found');
    expect((await app.inject({ url: '/../../package.json' })).body).toContain('<title>CANDY</title>');
    await app.close();
  });

  it('explains how to build when the app has not been built', async () => {
    const app = await buildApp({ db, webDir: join(dir, 'missing') });
    const r = await app.inject({ url: '/' });
    expect(r.statusCode).toBe(404);
    expect(r.body).toContain('build:web');
    await app.close();
  });
});

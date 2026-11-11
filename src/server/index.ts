import { createPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { seedBase } from './db/seed.js';
import { EventHub } from './events.js';
import { buildApp } from './app.js';
import { serverConfig } from './config.js';
import { syncMissingAssets } from './assetSync.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
// Local-only by default (127.0.0.1:3100). Hosting sets HOST=0.0.0.0, COOKIE_SECURE=true, TRUST_PROXY=1 (see docs/DEPLOY.md).
const cfg = serverConfig(process.env);
if (cfg.problems.length) {
  for (const p of cfg.problems) console.error(p);
  process.exit(1);
}
const { host, port } = cfg;

const db = createPool(url);
await migrate(db);
await seedBase(db);
// Hosting keeps assets on a volume (ASSETS_DIR). Copy any that ship in the image but are missing there; never overwrite.
if (process.env.ASSETS_SEED_DIR || process.env.ASSETS_DIR) {
  const copied = syncMissingAssets(process.env.ASSETS_SEED_DIR ?? 'assets', cfg.assetsDir);
  if (copied.length) console.log(`Copied ${copied.length} asset file(s) from the app image to ${cfg.assetsDir}`);
}
const hub = new EventHub(db, url);
await hub.start();
const app = await buildApp({
  db, hub, logger: true, webDir: cfg.webDir, storageDir: cfg.storageDir, assetsDir: cfg.assetsDir,
  maxUploadBytes: cfg.maxUploadBytes, secureCookies: cfg.secureCookies, hsts: cfg.hsts, trustProxy: cfg.trustProxy,
  workerToken: cfg.workerToken,
});
console.log(`CANDY Control Room: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
await app.listen({ port, host });

const shutdown = async () => {
  await app.close();
  await hub.stop();
  await db.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { createPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { seedBase } from './db/seed.js';
import { EventHub } from './events.js';
import { buildApp } from './app.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3100);
// Local-only by default; set HOST=0.0.0.0 deliberately if you ever expose it on a network.
const host = process.env.HOST ?? '127.0.0.1';

const db = createPool(url);
await migrate(db);
await seedBase(db);
const hub = new EventHub(db, url);
await hub.start();
const maxUploadMb = Number(process.env.UPLOAD_MAX_MB ?? 500);
const app = await buildApp({
  db, hub, logger: true, webDir: 'web/dist', storageDir: process.env.STORAGE_DIR ?? 'storage',
  maxUploadBytes: maxUploadMb * 1024 * 1024, secureCookies: process.env.COOKIE_SECURE === 'true',
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

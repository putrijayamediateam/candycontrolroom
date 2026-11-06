import { fileURLToPath } from 'node:url';
import { hash } from '@node-rs/argon2';
import { createPool, tx, type Db } from './pool.js';
import { migrate } from './migrate.js';
import { STAFF } from '../../shared/staff.js';

export async function seedBase(db: Db) {
  await tx(db, async (c) => {
    let i = 0;
    for (const s of STAFF) {
      await c.query(
        `INSERT INTO staff (id, display_name, role_title, department, reports_to, avatar, colour, deliverables, allowed_actions, prohibited_actions, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.role, s.department, s.reportsTo, s.avatar, s.colour, s.deliverables, s.allowed, s.prohibited, i++]);
    }
    for (const p of ['facebook', 'instagram', 'tiktok', 'threads'])
      await c.query(`INSERT INTO daily_targets (platform, feed_target) VALUES ($1,3) ON CONFLICT DO NOTHING`, [p]);
    for (const p of ['gbp', 'youtube'])
      await c.query(`INSERT INTO daily_targets (platform, feed_target) VALUES ($1,0) ON CONFLICT DO NOTHING`, [p]);
    for (const id of ['anthropic', 'google_drive', 'google_calendar', 'gbp', 'youtube', 'meta', 'tiktok', 'github', 'canva'])
      await c.query(`INSERT INTO connections (id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
    await c.query(`INSERT INTO app_settings(key,value) VALUES ('mode','"connected"'),('publishing_paused','false') ON CONFLICT DO NOTHING`);
  });
}

export async function createUser(db: Db, email: string, name: string, role: 'owner' | 'clinical_reviewer' | 'reviewer', password: string) {
  const r = await db.query(
    `INSERT INTO users (email, display_name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id`,
    [email, name, role, await hash(password)]);
  return r.rows[0].id as string;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createPool();
  migrate(db).then(() => seedBase(db)).then(() => { console.log('seeded 21 staff'); return db.end(); });
}

/**
 * Creates AIN's owner account if missing, or sets a new random password for it.
 * The password is written to .local-owner-password (git-ignored) and never printed.
 * Every existing session is signed out.
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createPool } from '../src/server/db/pool.js';
import { migrate } from '../src/server/db/migrate.js';
import { seedBase, createUser } from '../src/server/db/seed.js';
import { setPassword } from '../src/server/auth.js';

const email = process.argv[2] ?? 'putrijaya.businessdevelopment@gmail.com';
const db = createPool();
await migrate(db); await seedBase(db);
const pw = randomBytes(15).toString('base64url');
const owner = (await db.query(`SELECT id, email FROM users WHERE role='owner' ORDER BY created_at LIMIT 1`)).rows[0];
if (owner) await setPassword(db, owner.id, pw);
else await createUser(db, email, 'AIN', 'owner', pw);
writeFileSync('.local-owner-password', pw + '\n', { mode: 0o600 });
console.log(`${owner ? 'Password reset' : 'Owner created'} for ${owner?.email ?? email}. New password saved in .local-owner-password`);
await db.end();

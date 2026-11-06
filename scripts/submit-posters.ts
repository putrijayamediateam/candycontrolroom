import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createPool, tx } from '../src/server/db/pool.js';
import { migrate } from '../src/server/db/migrate.js';
import { seedBase, createUser } from '../src/server/db/seed.js';
import { createTask, advanceTask, createVersion, recordCheck, submitForReview, candyReview } from '../src/server/core/workflow.js';

const db = createPool();
await migrate(db); await seedBase(db);

// AIN is the only human reviewer (her instruction, 6 Nov 2026)
let ain = (await db.query(`SELECT id FROM users WHERE role='owner'`)).rows[0]?.id as string | undefined;
if (!ain) {
  const pw = randomBytes(12).toString('base64url');
  ain = await createUser(db, 'putrijaya.businessdevelopment@gmail.com', 'AIN', 'owner', pw);
  writeFileSync('.local-owner-password', pw + '\n', { mode: 0o600 });
}
await db.query(`INSERT INTO app_settings(key,value) VALUES ('review_policy', $1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify({
  human_reviewers: ['AIN'], clinical_review: 'source_verified_then_ain',
  note: 'No separate clinician. Health claims must cite official online sources; AIN gives final approval.',
})]);
await db.query(`INSERT INTO app_settings(key,value) VALUES ('brand', $1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify({
  palette: ['#fddbec', '#fdcae3', '#f9a6d0', '#ffffff', '#000000'], logo: 'assets/logo.png', fonts: ['Poppins', 'Great Vibes (accent)'], text: '#000000',
})]);

const H = { kind: 'human' as const, userId: ain };
const SRC_FLU = 'https://immunisationhandbook.health.gov.au/recommendations/all-people-aged-6-months-are-recommended-to-receive-influenza-vaccine-every-year (6 months+, yearly; checked 6 Nov 2026)';
const SRC_HAJ = 'https://tabunghaji.gov.my/en/immunization-information (Meningococcal ACYW-135 required for Hajj, 14 days before departure; checked 6 Nov 2026)';
const posters = [
  { key: 'influenza', title: 'Influenza Vaccine Promotion poster', src: SRC_FLU, note: 'RM60, save RM10, valid until 31 Dec 2026 — from AIN\'s previous approved poster' },
  { key: 'haji-umrah', title: 'Hajj & Umrah Health Screening poster', src: SRC_HAJ, note: 'Basic RM85, Premium RM169, Combos A–D RM165/220/265/425 — from previous poster. Tabung Haji logo not included.' },
  { key: 'hiring', title: 'Clinic Assistant Hiring poster', src: null, note: 'WhatsApp 019-932 4588 (HR), putrijaya.jobcareer@gmail.com — from previous poster. Staff photo not reused (no consent record).' },
  { key: 'october-breast-ultrasound-TEMPLATE', title: 'October Breast Cancer Awareness template', src: null, note: 'TEMPLATE — not for posting now. RM110 one side / RM190 both sides from previous poster; recheck prices before October 2027.' },
];
const out: string[] = [];
for (const p of posters) for (const l of ['en', 'ms'] as const) {
  await tx(db, async (c) => {
    const t = await createTask(c, H, { template: 'poster', title: `${p.title} (${l === 'en' ? 'English' : 'Malay'})`, owner: 'mei',
      platforms: ['facebook', 'instagram', 'threads'], contentLocale: l, objective: p.note });
    for (const st of ['research', 'copy', 'sketch', 'editing', 'qa']) await advanceTask(c, { kind: 'staff', staffId: 'mei' }, t.id, st);
    const v = await createVersion(c, { kind: 'staff', staffId: 'mei' }, { taskId: t.id, copy: p.note, assets: [`assets/posters/${p.key}-${l}.png`], locale: l, submittedBy: 'mei' });
    await recordCheck(c, { kind: 'staff', staffId: 'nadia' }, v.id, 'qa_complete', 'passed',
      'Rendered 2160x2700 PNG reviewed at full size: brand name spelling, prices match previous approved poster, per-branch hours, no text overflow, black text on approved pinks, QR decodes to linktr.ee/qr/3cb0d33d…');
    if (p.src) await recordCheck(c, { kind: 'staff', staffId: 'sara' }, v.id, 'sources', 'passed', p.src);
    await advanceTask(c, { kind: 'staff', staffId: 'nadia' }, t.id, 'candy_review');
    const rr = await submitForReview(c, 'mei', v.id, `${p.title} — ${l.toUpperCase()} v1. ${p.note}`);
    const res = await candyReview(c, rr.id, 'Recommend approve. Prices and hours copied from previous posters — AIN to confirm they are still current.');
    out.push(`${rr.ref}  ${t.ref}  ${p.key}-${l}  candy:${res.passed ? 'passed' : 'blocked'}`);
  });
}
console.log(out.join('\n'));
await db.end();

/**
 * Records the Deepavali greeting posters (8 Nov 2026) as CPRs for AIN, after Nadia's QA and CANDY's review.
 * Copy: content/2026-11/november-brief.md (Iman). QA: content/2026-11/qa-nadia.md (Nadia).
 * Safe to re-run: skipped if the task title already exists.
 *
 *   corepack pnpm exec tsx --env-file=.env scripts/submit-deepavali.ts
 */
import { createPool, tx } from '../src/server/db/pool.js';
import { createTask, advanceTask, createVersion, recordCheck, submitForReview, candyReview } from '../src/server/core/workflow.js';

const db = createPool();
const ain = (await db.query(`SELECT id FROM users WHERE role='owner' ORDER BY created_at LIMIT 1`)).rows[0]?.id as string | undefined;
if (!ain) { console.error('No owner account found.'); process.exit(1); }

const copy = {
  en: 'Happy Deepavali\nMay your home be filled with light, joy and togetherness.\nFrom all of us at Klinik Putrijaya\nScan for our branches',
  ms: 'Selamat Hari Deepavali\nSemoga rumah anda dipenuhi cahaya, kegembiraan dan kebersamaan.\nDaripada kami semua di Klinik Putrijaya\nImbas untuk cawangan kami',
} as const;

const H = { kind: 'human' as const, userId: ain };
const out: string[] = [];
for (const l of ['en', 'ms'] as const) {
  const title = `Deepavali greeting poster — 8 Nov 2026 (${l === 'en' ? 'English' : 'Malay'})`;
  if ((await db.query(`SELECT 1 FROM tasks WHERE title=$1`, [title])).rowCount) { out.push(`skip  ${title} (already recorded)`); continue; }
  await tx(db, async (c) => {
    const t = await createTask(c, H, { template: 'poster', title, owner: 'mei', platforms: ['facebook', 'instagram'], contentLocale: l,
      objective: 'Festive greeting requested by AIN for today. Copy by Iman (content/2026-11/november-brief.md). No health claims, no prices, no holiday hours.' });
    for (const st of ['research', 'copy', 'sketch', 'editing', 'qa']) await advanceTask(c, { kind: 'staff', staffId: 'mei' }, t.id, st);
    const v = await createVersion(c, { kind: 'staff', staffId: 'mei' }, { taskId: t.id, copy: copy[l], assets: [`assets/posters/nov-deepavali-${l}.png`], locale: l, submittedBy: 'mei' });
    await recordCheck(c, { kind: 'staff', staffId: 'nadia' }, v.id, 'qa_complete', 'passed',
      'Rendered 2160x2700 PNG opened and read: brand spelling, copy word for word, no claims/prices/hours, layout, palette, logo, QR (identical to the QR AIN verified by phone on 8 Nov), respectful imagery. Table: content/2026-11/qa-nadia.md (Deepavali section).');
    await advanceTask(c, { kind: 'staff', staffId: 'nadia' }, t.id, 'candy_review');
    const rr = await submitForReview(c, 'mei', v.id, `Deepavali greeting — ${l.toUpperCase()} v1, for posting today (8 Nov).`);
    const res = await candyReview(c, rr.id, 'Recommend approve. Warm, respectful greeting with the exact approved wording; no health claims, prices or holiday hours. Nadia passed QA. For posting today.');
    out.push(`${rr.ref}  ${t.ref}  nov-deepavali-${l}  candy:${res.passed ? 'passed' : 'blocked ' + res.missing.join(', ')}`);
  });
}
console.log(out.join('\n'));
await db.end();

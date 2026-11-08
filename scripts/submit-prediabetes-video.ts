/**
 * Records the prediabetes awareness video (8 Nov 2026) as a CPR for AIN, after Nadia's QA re-check and CANDY's review.
 * Script: content/2026-11/november-brief.md (Sara + Iman, CANDY correction). QA: content/2026-11/qa-nadia.md.
 * No identifiable people appear (original animated mascot), so no consent record is needed.
 * Safe to re-run: skipped if the task title already exists.
 *
 *   corepack pnpm exec tsx --env-file=.env scripts/submit-prediabetes-video.ts
 */
import { createPool, tx } from '../src/server/db/pool.js';
import { createTask, advanceTask, createVersion, recordCheck, submitForReview, candyReview } from '../src/server/core/workflow.js';

const db = createPool();
const ain = (await db.query(`SELECT id FROM users WHERE role='owner' ORDER BY created_at LIMIT 1`)).rows[0]?.id as string | undefined;
if (!ain) { console.error('No owner account found.'); process.exit(1); }

const title = 'Prediabetes awareness video — talking mascot, 50 s (English)';
const script = [
  'Did you know your blood sugar can be high… without you feeling it?',
  "That's called prediabetes. Your blood sugar is higher than normal, but not yet type 2 diabetes.",
  'You can have it for years, with no clear symptoms.',
  "Your risk is higher if you're overweight, 45 or older, or have a parent, brother or sister with type 2 diabetes.",
  'The good news? Healthy changes can cut your risk of type 2 diabetes in half.',
  'Try at least 150 minutes of brisk walking a week. Losing just 5 to 7 percent of your weight helps too.',
  'And a simple blood sugar test can tell you where you stand.',
  'Get your blood sugar checked at Klinik Putrijaya. See you soon!',
  'End card: Get your blood sugar checked at Klinik Putrijaya · Scan for our branches + QR · Source: US CDC',
].join('\n');

if ((await db.query(`SELECT 1 FROM tasks WHERE title=$1`, [title])).rowCount) { console.log('skip (already recorded)'); await db.end(); process.exit(0); }
const H = { kind: 'human' as const, userId: ain };
const out = await tx(db, async (c) => {
  const t = await createTask(c, H, { template: 'short_video', title, owner: 'farah', platforms: ['instagram', 'tiktok', 'facebook'], contentLocale: 'en',
    requiresConsent: false,
    objective: 'Ordered by AIN in CANDY\'s head chat on 8 Nov 2026. 1080x1920 vertical, original mascot (keeps nurse cap per AIN), built-in Windows voice (Zira) + captions; a captions-only copy is included.' });
  for (const st of ['research', 'copy', 'sketch', 'production', 'editing', 'qa']) await advanceTask(c, { kind: 'staff', staffId: 'farah' }, t.id, st);
  const v = await createVersion(c, { kind: 'staff', staffId: 'arjun' }, {
    taskId: t.id, copy: script, locale: 'en', submittedBy: 'arjun',
    assets: ['assets/video/prediabetes-en.mp4', 'assets/video/prediabetes-en-captions-only.mp4', 'assets/video/prediabetes-en-cover.png'] });
  await recordCheck(c, { kind: 'staff', staffId: 'sara' }, v.id, 'sources', 'passed',
    'US CDC, "Prediabetes: Your Chance to Prevent Type 2 Diabetes", https://www.cdc.gov/diabetes/prevention-type-2/prediabetes-prevent-type-2.html (opened 8 Nov 2026; no plain-language WHO/KKM page found). Beats 4 and 6 corrected to CDC wording after QA.');
  await recordCheck(c, { kind: 'staff', staffId: 'nadia' }, v.id, 'qa_complete', 'passed',
    'Re-check passed on all 3 files: wording vs script and CDC, spelling, logo, palette, platform safe zones (y 220-1540), 4:5 cover crop, end-card QR module match, 49.77 s, caption timing vs measured speech. Spoken words not verified by ear. Table: content/2026-11/qa-nadia.md.');
  await advanceTask(c, { kind: 'staff', staffId: 'nadia' }, t.id, 'candy_review');
  const rr = await submitForReview(c, 'arjun', v.id, 'Prediabetes awareness video v2 (after QA fixes): voice + captions MP4, captions-only MP4, cover.');
  const res = await candyReview(c, rr.id,
    'Recommend approve after you listen once with sound. Every line is sourced to the US CDC (two lines corrected to its exact wording), text sits clear of Instagram/TikTok buttons, and the mascot is original. Nobody here could listen to the synthetic voice, so please play it before approving. Use the captions-only copy if you dislike the voice.');
  return `${rr.ref}  ${t.ref}  prediabetes video  candy:${res.passed ? 'passed' : 'blocked ' + res.missing.join(', ')}`;
});
console.log(out);
await db.end();

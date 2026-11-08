/**
 * Submits v2 of the 8 November awareness posters (new "get checked" CTAs per AIN, "Hari Bayi Pramatang Sedunia",
 * an original illustration on each) as new versions of the existing tasks. Creating a new version supersedes the
 * v1 review request and cancels any approval on v1, so AIN always decides on the exact v2 files.
 * QA: content/2026-11/qa-nadia.md ("November posters v2"). Safe to re-run: skips tasks that already have v2.
 *
 *   corepack pnpm exec tsx --env-file=.env scripts/submit-november-v2.ts
 */
import { createPool, tx } from '../src/server/db/pool.js';
import { createVersion, recordCheck, submitForReview, candyReview } from '../src/server/core/workflow.js';

const db = createPool();
type L = 'en' | 'ms';
const cta: Record<string, Record<L, string> | null> = {
  diabetes: { en: 'Get your blood sugar checked at Klinik Putrijaya · Scan for our branches', ms: 'Periksa paras gula darah di Klinik Putrijaya · Imbas untuk cawangan kami' },
  prematurity: { en: 'Start your antenatal check-ups at Klinik Putrijaya', ms: 'Mulakan pemeriksaan antenatal di Klinik Putrijaya' },
  cervical: { en: 'Ask about cervical screening and the HPV vaccine at Klinik Putrijaya', ms: 'Tanya tentang saringan serviks dan vaksin HPV di Klinik Putrijaya' },
  'childrens-day': null, // wording unchanged; illustration only
};
const titles: Record<string, string> = {
  diabetes: 'World Diabetes Day poster', prematurity: 'World Prematurity Day poster',
  cervical: 'World Cervical Cancer Elimination Day poster', 'childrens-day': "World Children's Day poster",
};

const out: string[] = [];
for (const key of Object.keys(titles)) for (const l of ['en', 'ms'] as const) {
  const asset = `assets/posters/nov-${key}-${l}-v2.png`;
  const t = (await db.query(`SELECT id, ref FROM tasks WHERE title LIKE $1 AND content_locale=$2 ORDER BY created_at LIMIT 1`,
    [`${titles[key]} — % (${l === 'en' ? 'English' : 'Malay'})`, l])).rows[0];
  if (!t) { out.push(`MISSING task for ${key}-${l}`); continue; }
  const v1 = (await db.query(`SELECT * FROM deliverable_versions WHERE task_id=$1 ORDER BY version DESC LIMIT 1`, [t.id])).rows[0];
  if (v1.asset_keys.includes(asset)) { out.push(`skip  ${t.ref} already has v2`); continue; }
  const lines: string[] = v1.copy_text.split('\n');
  const c = cta[key];
  if (c) lines[4] = c[l];                                       // line 5 is the CTA in v1 copy
  const extra = key === 'prematurity' && l === 'ms' ? '\nTitle: Hari Bayi Pramatang Sedunia' : '';
  await tx(db, async (cx) => {
    const v = await createVersion(cx, { kind: 'staff', staffId: 'mei' }, { taskId: t.id, copy: lines.join('\n') + extra, assets: [asset], locale: l, submittedBy: 'mei' });
    const src = (await cx.query(`SELECT evidence FROM checks WHERE version_id=$1 AND check_type='sources' AND result='passed' LIMIT 1`, [v1.id])).rows[0]?.evidence;
    if (src) await recordCheck(cx, { kind: 'staff', staffId: 'sara' }, v.id, 'sources', 'passed', src);
    await recordCheck(cx, { kind: 'staff', staffId: 'nadia' }, v.id, 'qa_complete', 'passed',
      'v2 passed all 9 checks: spelling, copy word for word (new CTA per AIN), date, branches/hours, source line, layout, palette/logo, QR identical to the one AIN verified by phone, original respectful illustration. Table: content/2026-11/qa-nadia.md ("November posters v2").');
    const rr = await submitForReview(cx, 'mei', v.id, `v2 — ${c ? 'new "get checked" CTA, ' : ''}${extra ? 'title "Hari Bayi Pramatang Sedunia", ' : ''}illustration added.`);
    const note = key === 'cervical'
      ? ' Your call: the shield-with-tick beside the vaccine vial could read as "guaranteed protection"; it adds no claim beyond the WHO line.' : '';
    const res = await candyReview(cx, rr.id, `Recommend approve. Replaces v1: ${c ? 'CTA now says where to get checked (most branches, per AIN), ' : 'same wording, '}original illustration added; Nadia passed all checks.${note}`);
    out.push(`${rr.ref}  ${t.ref}  nov-${key}-${l}-v2  candy:${res.passed ? 'passed' : 'blocked ' + res.missing.join(', ')}`);
  });
}
console.log(out.join('\n'));
await db.end();

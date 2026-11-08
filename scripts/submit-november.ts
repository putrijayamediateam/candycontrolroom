/**
 * Records the 8 November 2026 posters (Mei) as CPRs for AIN, after Nadia's QA and CANDY's review.
 * Copy: content/2026-11/november-brief.md (Iman). QA: content/2026-11/qa-nadia.md (Nadia).
 * Safe to re-run: a poster whose task title already exists is skipped.
 *
 *   corepack pnpm exec tsx --env-file=.env scripts/submit-november.ts
 */
import { createPool, tx } from '../src/server/db/pool.js';
import { createTask, advanceTask, createVersion, recordCheck, submitForReview, candyReview } from '../src/server/core/workflow.js';

const db = createPool();
const ain = (await db.query(`SELECT id FROM users WHERE role='owner' ORDER BY created_at LIMIT 1`)).rows[0]?.id as string | undefined;
if (!ain) { console.error('No owner account found.'); process.exit(1); }

const WHO_DIAB = 'https://www.who.int/campaigns/world-diabetes-day/2026';
const WHO_PRE = 'https://www.who.int/campaigns/world-prematurity-day/2025 ; https://www.who.int/news-room/fact-sheets/detail/preterm-birth';
const WHO_CERV = 'https://www.who.int/news-room/fact-sheets/detail/cervical-cancer ; WHA78.8 day designation';
const UNICEF = 'https://www.unicef.org/malaysia/world-childrens-day';

type L = 'en' | 'ms';
const posters: { key: string; title: string; day: string; source: string; copy: Record<L, string> }[] = [
  { key: 'diabetes', title: 'World Diabetes Day poster', day: '14 Nov 2026', source: WHO_DIAB, copy: {
    en: 'Diabetes can be silent\nMore than 40% of people with diabetes don\'t know they have it.\nThirst, frequent urination, tiredness, blurred vision — don\'t ignore the signs.\nEarly action starts with a check.\nVisit Klinik Putrijaya · Scan for our branches\nSource: WHO',
    ms: 'Diabetes boleh senyap\nLebih 40% penghidap diabetes tidak tahu mereka menghidapnya.\nKerap dahaga, kerap buang air kecil, letih, penglihatan kabur — jangan abaikan tandanya.\nTindakan awal bermula dengan pemeriksaan.\nKunjungi Klinik Putrijaya · Imbas untuk cawangan kami\nSumber: WHO' } },
  { key: 'prematurity', title: 'World Prematurity Day poster', day: '15 Nov 2026', source: WHO_PRE, copy: {
    en: 'A strong start for every baby\nAround 1 in 10 babies is born before 37 weeks.\nWHO advises at least 8 antenatal contacts, starting before 12 weeks.\nStart your pregnancy check-ups early.\nVisit Klinik Putrijaya · Scan for our branches\nSource: WHO',
    ms: 'Permulaan kukuh untuk setiap bayi\nKira-kira 1 daripada 10 bayi lahir sebelum 37 minggu.\nWHO mengesyorkan sekurang-kurangnya 8 sesi pemeriksaan antenatal, bermula sebelum 12 minggu.\nMulakan pemeriksaan kehamilan anda awal.\nKunjungi Klinik Putrijaya · Imbas untuk cawangan kami\nSumber: WHO' } },
  { key: 'cervical', title: 'World Cervical Cancer Elimination Day poster', day: '17 Nov 2026', source: WHO_CERV, copy: {
    en: 'Cervical cancer can be prevented\nAlmost all cases are caused by HPV.\nHPV vaccine protects; screening finds changes early.\nFound early, it can be cured.\nAsk your doctor about screening · Visit Klinik Putrijaya\nSource: WHO',
    ms: 'Kanser serviks boleh dicegah\nHampir semua kes berpunca daripada HPV.\nVaksin HPV melindungi; saringan mengesan perubahan lebih awal.\nJika dikesan awal, ia boleh dirawat sehingga sembuh.\nTanya doktor tentang saringan · Kunjungi Klinik Putrijaya\nSumber: WHO' } },
  { key: 'childrens-day', title: "World Children's Day poster", day: '20 Nov 2026', source: UNICEF, copy: {
    en: 'Every child, every right\n20 November is World Children\'s Day.\nThis year: "My Day. My Rights. My Future."\nHealthy, happy children start with caring families.\nScan for our branches · Klinik Putrijaya\nSource: UNICEF',
    ms: 'Setiap kanak-kanak, setiap hak\n20 November ialah Hari Kanak-kanak Sedunia.\nTema tahun ini: "My Day. My Rights. My Future."\nKanak-kanak sihat dan gembira bermula dengan keluarga penyayang.\nImbas untuk cawangan kami · Klinik Putrijaya\nSumber: UNICEF' } },
];

const H = { kind: 'human' as const, userId: ain };
const out: string[] = [];
for (const p of posters) for (const l of ['en', 'ms'] as const) {
  const title = `${p.title} — ${p.day} (${l === 'en' ? 'English' : 'Malay'})`;
  if ((await db.query(`SELECT 1 FROM tasks WHERE title=$1`, [title])).rowCount) { out.push(`skip  ${title} (already recorded)`); continue; }
  await tx(db, async (c) => {
    const t = await createTask(c, H, { template: 'poster', title, owner: 'mei', platforms: ['facebook', 'instagram'], contentLocale: l,
      objective: `November 2026 awareness poster. Copy by Iman, sources by Sara (content/2026-11/november-brief.md). No prices or promotions. Planned post: ${p.day}.` });
    for (const st of ['research', 'copy', 'sketch', 'editing', 'qa']) await advanceTask(c, { kind: 'staff', staffId: 'mei' }, t.id, st);
    const v = await createVersion(c, { kind: 'staff', staffId: 'mei' }, { taskId: t.id, copy: p.copy[l], assets: [`assets/posters/nov-${p.key}-${l}.png`], locale: l, submittedBy: 'mei' });
    await recordCheck(c, { kind: 'staff', staffId: 'sara' }, v.id, 'sources', 'passed', `${p.source} (official pages opened and checked 8 Nov 2026)`);
    await recordCheck(c, { kind: 'staff', staffId: 'nadia' }, v.id, 'qa_complete', 'passed',
      'Rendered 2160x2700 PNG opened and read: brand spelling, copy word for word vs approved brief, date, branches and hours, source line, no overflow, palette and logo measured. Full table: content/2026-11/qa-nadia.md. QR not decoded on this PC (pixel-identical to earlier posters).');
    await advanceTask(c, { kind: 'staff', staffId: 'nadia' }, t.id, 'candy_review');
    const rr = await submitForReview(c, 'mei', v.id, `${p.title} — ${l.toUpperCase()} v1 for ${p.day}. Awareness poster, no prices.`);
    const res = await candyReview(c, rr.id,
      'Recommend approve. Copy matches the approved brief word for word and every health line has an official source. Nadia passed all checks except the QR, which she could not decode here: it is pixel-identical to the QR on your earlier posters. Please scan it with your phone before approving. CTA says "talk to your doctor" style until you confirm which services the branches offer.');
    out.push(`${rr.ref}  ${t.ref}  nov-${p.key}-${l}  candy:${res.passed ? 'passed' : 'blocked ' + res.missing.join(', ')}`);
  });
}
console.log(out.join('\n'));
await db.end();

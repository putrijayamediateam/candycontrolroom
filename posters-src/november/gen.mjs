// Klinik Putrijaya — November 2026 awareness posters (EN + MS).
// Copy: content/2026-11/november-brief.md section 3, word for word. Design system: assets/build.py.
// Run: node posters-src/november/gen.mjs <version> [--render]
//   e.g. node posters-src/november/gen.mjs v3 --render
//   → writes <topic>-<lang>-<version>.html here and, with --render, assets/posters/nov-<topic>-<lang>-<version>.png via headless Chrome.
// Rule (CANDY, 8 Nov): never overwrite a poster that has been submitted for approval. The un-suffixed originals and any
// existing version are never written; the script refuses an empty version and skips any PNG that already exists.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const b64 = (p, mime) => `data:${mime};base64,` + fs.readFileSync(path.join(ROOT, p)).toString('base64');
const LOGO = b64('assets/logo.png', 'image/png');
const QR = b64('assets/qr.png', 'image/png');
const [P1, P2, P3, W, K] = ['#fddbec', '#fdcae3', '#f9a6d0', '#ffffff', '#000000'];

const FD = 'node_modules/@fontsource';
const ff = (fam, p, w) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(${b64(`${FD}/${p}`, 'font/woff2')}) format('woff2')}`;
const FONTS = [400, 500, 600, 700, 800, 900].map(w => ff('Poppins', `poppins/files/poppins-latin-${w}-normal.woff2`, w)).join('')
  + ff('Great Vibes', 'great-vibes/files/great-vibes-latin-400-normal.woff2', 400);

const CSS = FONTS + `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;font-family:Poppins,sans-serif;color:${K};background:${W};position:relative;overflow:hidden}
.blob{position:absolute;border-radius:50%;z-index:0}
.wrap{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;padding:56px 64px 0}
.logo{height:78px;display:block;margin:0 auto}
.pill{display:inline-block;background:${P3};border-radius:999px;padding:8px 26px;font-weight:700;font-size:24px;letter-spacing:3px}
.script{font-family:'Great Vibes',cursive;font-weight:400}
.card{background:${W};border:3px solid ${P3};border-radius:24px}
.ico{flex:none}
.line{display:flex;gap:18px;align-items:center;padding:14px 22px;font-size:28px;font-weight:500;line-height:1.3}
.cta{background:${K};color:${W};text-align:center;font-weight:700;font-size:28px;letter-spacing:1px;border-radius:44px;padding:14px 26px;line-height:1.3}
.src{text-align:center;font-size:19px;margin-top:12px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:6px}
.ill{display:block;margin:0 auto 6px;height:130px}
.foot{margin:auto -64px 0;background:${P1};border-top:3px solid ${P3};padding:26px 64px 30px;display:flex;gap:34px;align-items:center;font-size:19px;line-height:1.45}
.foot h4{font-size:19px;font-weight:800;letter-spacing:1px;margin-bottom:4px}
.foot .col{flex:1}
.qr{background:${W};border-radius:18px;padding:10px;text-align:center;font-weight:700;font-size:17px;border:3px solid ${P3}}
.qr img{width:118px;height:118px;display:block}
`;

const ICONS = {
  drop: '<path d="M32 6C24 20 14 30 14 40a18 18 0 0 0 36 0c0-10-10-20-18-34z"/><path d="M24 42a8 8 0 0 0 8 8"/>',
  eye: '<path d="M6 32s10-16 26-16 26 16 26 16-10 16-26 16S6 32 6 32z"/><circle cx="32" cy="32" r="7"/>',
  check: '<circle cx="32" cy="32" r="22"/><path d="M21 33l7 7 15-15"/>',
  baby: '<circle cx="32" cy="34" r="20"/><circle cx="25" cy="32" r="2" fill="#000"/><circle cx="39" cy="32" r="2" fill="#000"/><path d="M26 41q6 5 12 0"/><path d="M32 14q-4-6 2-8"/>',
  cal: '<rect x="10" y="14" width="44" height="40" rx="6"/><path d="M10 26h44M22 8v10M42 8v10"/><path d="M20 36h6M30 36h6M40 36h4M20 44h6M30 44h6"/>',
  steth: '<path d="M18 8v16a10 10 0 0 0 20 0V8"/><path d="M28 34v8a12 12 0 0 0 24 0v-6"/><circle cx="52" cy="32" r="5"/>',
  shield: '<path d="M32 6l22 8v16c0 14-10 24-22 28C20 54 10 44 10 30V14z"/><path d="M32 20v20M22 30h20"/>',
  scan: '<circle cx="28" cy="28" r="16"/><path d="M40 40l14 14"/>',
  heart: '<path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z"/>',
  star: '<path d="M32 8l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 25l16-2z"/>',
  family: '<circle cx="22" cy="18" r="7"/><circle cx="42" cy="18" r="7"/><circle cx="32" cy="38" r="5"/><path d="M10 52q0-20 12-20 6 0 8 4M54 52q0-20-12-20-6 0-8 4M24 56q0-10 8-10t8 10"/>',
};
const ico = (n, s = 52) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

const T = {
  en: { branches: 'OUR BRANCHES', hours: 'OPENING HOURS', scan: 'Scan me',
    br: 'Klinik Putrijaya Cheras<br>Klinik Putrijaya Sungai Besi<br>Klinik Putrijaya Puchong',
    hr: '<b>Cheras</b> · Mon–Sun · 8.00 AM–11.00 PM<br><b>Sungai Besi &amp; Puchong</b><br>Mon–Fri · 8.00 AM–10.00 PM<br>Sat–Sun · 9.00 AM–10.00 PM', src: 'Source' },
  ms: { branches: 'CAWANGAN', hours: 'WAKTU BEROPERASI', scan: 'Imbas di sini',
    br: 'Klinik Putrijaya Cheras<br>Klinik Putrijaya Sungai Besi<br>Klinik Putrijaya Puchong',
    hr: '<b>Cheras</b> · Isnin–Ahad · 8.00 AM–11.00 PM<br><b>Sungai Besi &amp; Puchong</b><br>Isnin–Jumaat · 8.00 AM–10.00 PM<br>Sabtu–Ahad · 9.00 AM–10.00 PM', src: 'Sumber' },
};
const footer = l => `<div class="foot"><div class="col" style="flex:.85"><h4>${T[l].branches}</h4>${T[l].br}</div><div class="col"><h4>${T[l].hours}</h4>${T[l].hr}</div><div class="qr"><img src="${QR}">${T[l].scan}</div></div>`;
const blobs = specs => specs.map(([x, y, s, c]) => `<div class="blob" style="width:${s}px;height:${s}px;left:${x}px;top:${y}px;background:${c}"></div>`).join('');

// Copy below is verbatim from november-brief.md section 3 (headline, lines, CTA; CTAs updated after AIN confirmed services, 8 Nov). Day names and dates from section 1; MS prematurity name from "Malay name for World Prematurity Day".
const POSTERS = {
  diabetes: { icons: ['drop', 'eye', 'check'], source: 'WHO', ill: 'meter', hs: { en: 76, ms: 76 },
    en: { date: '14 NOVEMBER', day: 'World Diabetes Day', h: 'Diabetes can be silent',
      lines: ["More than 40% of people with diabetes don't know they have it.", "Thirst, frequent urination, tiredness, blurred vision — don't ignore the signs.", 'Early action starts with a check.'],
      cta: 'Get your blood sugar checked at Klinik Putrijaya · Scan for our branches' },
    ms: { date: '14 NOVEMBER', day: 'Hari Diabetes Sedunia', h: 'Diabetes boleh senyap',
      lines: ['Lebih 40% penghidap diabetes tidak tahu mereka menghidapnya.', 'Kerap dahaga, kerap buang air kecil, letih, penglihatan kabur — jangan abaikan tandanya.', 'Tindakan awal bermula dengan pemeriksaan.'],
      cta: 'Periksa paras gula darah di Klinik Putrijaya · Imbas untuk cawangan kami' } },
  prematurity: { icons: ['baby', 'steth', 'cal'], source: 'WHO', ill: 'baby', hs: { en: 78, ms: 70 },
    en: { date: '15 NOVEMBER', day: 'World Prematurity Day', h: 'A strong start for every baby',
      lines: ['Around 1 in 10 babies is born before 37 weeks.', 'WHO advises at least 8 antenatal contacts, starting before 12 weeks.', 'Start your pregnancy check-ups early.'],
      cta: 'Start your antenatal check-ups at Klinik Putrijaya' },
    ms: { date: '15 NOVEMBER', day: 'Hari Bayi Pramatang Sedunia', h: 'Permulaan kukuh untuk setiap bayi',
      lines: ['Kira-kira 1 daripada 10 bayi lahir sebelum 37 minggu.', 'WHO mengesyorkan sekurang-kurangnya 8 sesi pemeriksaan antenatal, bermula sebelum 12 minggu.', 'Mulakan pemeriksaan kehamilan anda awal.'],
      cta: 'Mulakan pemeriksaan antenatal di Klinik Putrijaya' } },
  cervical: { icons: ['scan', 'shield', 'heart'], source: 'WHO', ill: 'vial', hs: { en: 78, ms: 78 },
    en: { date: '17 NOVEMBER', day: 'World Cervical Cancer Elimination Day', h: 'Cervical cancer can be prevented',
      lines: ['Almost all cases are caused by HPV.', 'HPV vaccine protects; screening finds changes early.', 'Found early, it can be cured.'],
      cta: 'Ask about cervical screening and the HPV vaccine at Klinik Putrijaya' },
    ms: { date: '17 NOVEMBER', day: 'Hari Penghapusan Kanser Serviks Sedunia', h: 'Kanser serviks boleh dicegah',
      lines: ['Hampir semua kes berpunca daripada HPV.', 'Vaksin HPV melindungi; saringan mengesan perubahan lebih awal.', 'Jika dikesan awal, ia boleh dirawat sehingga sembuh.'],
      cta: 'Tanya tentang saringan serviks dan vaksin HPV di Klinik Putrijaya' } },
  'childrens-day': { icons: ['cal', 'star', 'family'], source: 'UNICEF', ill: 'balloons', hs: { en: 84, ms: 72 },
    en: { date: '20 NOVEMBER', day: "World Children's Day", h: 'Every child, every right',
      lines: ["20 November is World Children's Day.", 'This year: "My Day. My Rights. My Future."', 'Healthy, happy children start with caring families.'],
      cta: 'Scan for our branches · Klinik Putrijaya' },
    ms: { date: '20 NOVEMBER', day: 'Hari Kanak-kanak Sedunia', h: 'Setiap kanak-kanak, setiap hak',
      lines: ['20 November ialah Hari Kanak-kanak Sedunia.', 'Tema tahun ini: "My Day. My Rights. My Future."', 'Kanak-kanak sihat dan gembira bermula dengan keluarga penyayang.'],
      cta: 'Imbas untuk cawangan kami · Klinik Putrijaya' } },
};

// Original vector illustrations (Mei), palette only, black outlines. No photos, no real people.
const SPARK = (x, y, r) => `<path d="M${x} ${y - r}C${x + r * .15} ${y - r * .2} ${x + r * .2} ${y - r * .15} ${x + r} ${y}C${x + r * .2} ${y + r * .15} ${x + r * .15} ${y + r * .2} ${x} ${y + r}C${x - r * .15} ${y + r * .2} ${x - r * .2} ${y + r * .15} ${x - r} ${y}C${x - r * .2} ${y - r * .15} ${x - r * .15} ${y - r * .2} ${x} ${y - r}Z" fill="#fff" stroke="#000" stroke-width="2"/>`;
const ILLUS = {
  meter: `<circle cx="160" cy="78" r="70" fill="${P1}" stroke="none"/>
    <rect x="146" y="4" width="16" height="26" rx="3" fill="#fff"/>
    <rect x="108" y="24" width="92" height="118" rx="20" fill="#fff"/>
    <rect x="121" y="38" width="66" height="46" rx="9" fill="${P2}"/>
    <path d="M154 46c-6 10-10 15-10 21a10 10 0 0 0 20 0c0-6-4-11-10-21z" fill="${P3}" stroke-width="3"/>
    <circle cx="135" cy="110" r="9" fill="${P3}"/><circle cx="173" cy="110" r="9" fill="${P3}"/>
    <path d="M240 30c-14 24-26 38-26 54a26 26 0 0 0 52 0c0-16-12-30-26-54z" fill="${P3}"/>
    <path d="M228 90a13 13 0 0 0 12 12" stroke="#fff" stroke-width="5"/>
    ${SPARK(70, 52, 14)}${SPARK(88, 112, 9)}`,
  baby: `<circle cx="160" cy="78" r="70" fill="${P1}" stroke="none"/>
    <path d="M150 44c30-12 96-8 106 34s-30 60-78 58c-30-2-48-18-50-40" fill="${P3}"/>
    <circle cx="124" cy="72" r="34" fill="#fff"/>
    <path d="M94 62q26-40 60-8z" fill="${P2}"/>
    <path d="M108 76q6 6 12 0M130 76q6 6 12 0" stroke-width="3.5"/>
    <path d="M118 90q7 5 14 0" stroke-width="3.5"/>
    <circle cx="106" cy="86" r="5" fill="${P3}" stroke="none"/><circle cx="144" cy="86" r="5" fill="${P3}" stroke="none"/>
    <path d="M160 104c26 10 58 8 82-10" stroke-width="3.5"/>
    <path d="M250 34c-4-8-16-6-16 2 0 8 16 16 16 16s16-8 16-16c0-8-12-10-16-2z" fill="${P2}"/>
    ${SPARK(64, 46, 12)}${SPARK(276, 100, 10)}`,
  vial: `<circle cx="160" cy="78" r="70" fill="${P1}" stroke="none"/>
    <rect x="102" y="56" width="56" height="86" rx="12" fill="#fff"/>
    <path d="M104 96h52v34a10 10 0 0 1-10 10h-32a10 10 0 0 1-10-10z" fill="${P2}" stroke="none"/>
    <rect x="102" y="56" width="56" height="86" rx="12"/>
    <rect x="110" y="44" width="40" height="14" rx="3" fill="#fff"/>
    <rect x="104" y="24" width="52" height="22" rx="6" fill="${P3}"/>
    <path d="M124 74h12M130 68v12" stroke-width="3.5"/>
    <path d="M212 30l38 13v28c0 24-17 40-38 46-21-6-38-22-38-46V43z" fill="${P3}"/>
    <path d="M196 74l11 11 22-22" stroke-width="5"/>
    ${SPARK(66, 60, 13)}${SPARK(270, 120, 9)}`,
  balloons: `<circle cx="160" cy="78" r="70" fill="${P1}" stroke="none"/>
    <path d="M116 98q10 26 44 44M164 84q-6 30-4 58M212 100q-12 26-52 42" stroke-width="3"/>
    <ellipse cx="116" cy="62" rx="30" ry="36" fill="${P3}"/><path d="M111 101l5-5 5 5z" fill="${P3}"/>
    <ellipse cx="164" cy="48" rx="30" ry="36" fill="#fff"/><path d="M159 87l5-5 5 5z" fill="#fff"/>
    <ellipse cx="212" cy="64" rx="30" ry="36" fill="${P2}"/><path d="M207 103l5-5 5 5z" fill="${P2}"/>
    <path d="M102 50q3-10 12-13M198 52q3-10 12-13" stroke="#fff" stroke-width="5"/>
    <path d="M150 36q3-10 12-13" stroke="${P2}" stroke-width="5"/>
    ${SPARK(60, 108, 12)}${SPARK(266, 28, 11)}`,
};
const illus = n => `<svg class="ill" viewBox="0 0 320 150" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${ILLUS[n]}</svg>`;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function poster(p, l) {
  const x = p[l];
  const dayLen = x.day.length;
  const daySize = dayLen > 30 ? 52 : dayLen > 22 ? 66 : 76;
  const lines = x.lines.map((t, i) => `<div class="card line">${ico(p.icons[i], 54)}<span>${esc(t)}</span></div>`).join('');
  return blobs([[640, -260, 720, P1], [-260, 760, 520, P2], [840, 600, 360, P1]]) + `
<div class="wrap">
 <img class="logo" src="${LOGO}">
 <div class="mid">
 ${illus(p.ill)}
 <div style="text-align:center"><span class="pill">${x.date} 2026</span></div>
 <div class="script" style="text-align:center;font-size:${daySize}px;line-height:1.08;margin-top:4px">${esc(x.day)}</div>
 <div style="text-align:center;font-weight:900;font-size:${p.hs[l]}px;line-height:1.04;margin-top:6px">${esc(x.h)}</div>
 <div style="display:flex;flex-direction:column;gap:12px;margin-top:22px;background:${P1};padding:14px;border-radius:28px">${lines}</div>
 <div class="cta" style="margin-top:20px">${esc(x.cta).replace(/Klinik Putrijaya/g, '<span style="white-space:nowrap">Klinik Putrijaya</span>')}</div>
 <div class="src">${T[l].src}: ${p.source}</div>
 </div>
 ${footer(l)}
</div>`;
}

const VERSION = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
if (!/^v\d+$/.test(VERSION)) {
  console.error('Give a version like v2 or v3. Un-suffixed posters are the submitted originals and are never re-rendered.');
  process.exit(1);
}
const RENDER = process.argv.includes('--render');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.join(ROOT, 'assets', 'posters');

for (const [name, p] of Object.entries(POSTERS)) {
  for (const l of ['en', 'ms']) {
    const base = `${name}-${l}-${VERSION}`;
    const htmlFile = path.join(HERE, `${base}.html`);
    const html = `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${base}</title><style>${CSS}</style></head><body>${poster(p, l)}</body></html>`;
    fs.writeFileSync(htmlFile, html);
    console.log('wrote', `${base}.html`);
    if (!RENDER) continue;
    const png = path.join(OUT, `nov-${base}.png`);
    if (fs.existsSync(png)) { console.log('  skip', path.basename(png), '(already exists; may be submitted for approval; use a new version)'); continue; }
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=1080,1350',
      '--virtual-time-budget=5000', `--user-data-dir=${path.join(HERE, '.chrome-profile')}`, `--screenshot=${png}`, 'file:///' + htmlFile.replace(/\\/g, '/')]);
    console.log(fs.existsSync(png) ? '  rendered' : '  FAILED', path.basename(png), r.status ?? '');
  }
}

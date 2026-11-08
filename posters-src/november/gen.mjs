// Klinik Putrijaya — November 2026 awareness posters (EN + MS).
// Copy: content/2026-11/november-brief.md section 3, word for word. Design system: assets/build.py.
// Run: node posters-src/november/gen.mjs  → writes <topic>-<lang>.html here; render with headless Chrome.
import fs from 'node:fs';
import path from 'node:path';
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
.line{display:flex;gap:20px;align-items:center;padding:20px 26px;font-size:31px;font-weight:500;line-height:1.3}
.cta{background:${K};color:${W};text-align:center;font-weight:700;font-size:28px;letter-spacing:1px;border-radius:999px;padding:16px 24px}
.src{text-align:center;font-size:19px;margin-top:12px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:24px}
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

// Copy below is verbatim from november-brief.md section 3 (headline, lines, CTA). Day names and dates are from section 1.
const POSTERS = {
  diabetes: { icons: ['drop', 'eye', 'check'], source: 'WHO', hs: { en: 92, ms: 92 },
    en: { date: '14 NOVEMBER', day: 'World Diabetes Day', h: 'Diabetes can be silent',
      lines: ["More than 40% of people with diabetes don't know they have it.", "Thirst, frequent urination, tiredness, blurred vision — don't ignore the signs.", 'Early action starts with a check.'],
      cta: 'Visit Klinik Putrijaya · Scan for our branches' },
    ms: { date: '14 NOVEMBER', day: 'Hari Diabetes Sedunia', h: 'Diabetes boleh senyap',
      lines: ['Lebih 40% penghidap diabetes tidak tahu mereka menghidapnya.', 'Kerap dahaga, kerap buang air kecil, letih, penglihatan kabur — jangan abaikan tandanya.', 'Tindakan awal bermula dengan pemeriksaan.'],
      cta: 'Kunjungi Klinik Putrijaya · Imbas untuk cawangan kami' } },
  prematurity: { icons: ['baby', 'steth', 'cal'], source: 'WHO', hs: { en: 84, ms: 76 },
    en: { date: '15 NOVEMBER', day: 'World Prematurity Day', h: 'A strong start for every baby',
      lines: ['Around 1 in 10 babies is born before 37 weeks.', 'WHO advises at least 8 antenatal contacts, starting before 12 weeks.', 'Start your pregnancy check-ups early.'],
      cta: 'Visit Klinik Putrijaya · Scan for our branches' },
    ms: { date: '15 NOVEMBER', day: 'Hari Pramatang Sedunia', h: 'Permulaan kukuh untuk setiap bayi',
      lines: ['Kira-kira 1 daripada 10 bayi lahir sebelum 37 minggu.', 'WHO mengesyorkan sekurang-kurangnya 8 sesi pemeriksaan antenatal, bermula sebelum 12 minggu.', 'Mulakan pemeriksaan kehamilan anda awal.'],
      cta: 'Kunjungi Klinik Putrijaya · Imbas untuk cawangan kami' } },
  cervical: { icons: ['scan', 'shield', 'heart'], source: 'WHO', hs: { en: 84, ms: 84 },
    en: { date: '17 NOVEMBER', day: 'World Cervical Cancer Elimination Day', h: 'Cervical cancer can be prevented',
      lines: ['Almost all cases are caused by HPV.', 'HPV vaccine protects; screening finds changes early.', 'Found early, it can be cured.'],
      cta: 'Ask your doctor about screening · Visit Klinik Putrijaya' },
    ms: { date: '17 NOVEMBER', day: 'Hari Penghapusan Kanser Serviks Sedunia', h: 'Kanser serviks boleh dicegah',
      lines: ['Hampir semua kes berpunca daripada HPV.', 'Vaksin HPV melindungi; saringan mengesan perubahan lebih awal.', 'Jika dikesan awal, ia boleh dirawat sehingga sembuh.'],
      cta: 'Tanya doktor tentang saringan · Kunjungi Klinik Putrijaya' } },
  'childrens-day': { icons: ['cal', 'star', 'family'], source: 'UNICEF', hs: { en: 92, ms: 76 },
    en: { date: '20 NOVEMBER', day: "World Children's Day", h: 'Every child, every right',
      lines: ["20 November is World Children's Day.", 'This year: "My Day. My Rights. My Future."', 'Healthy, happy children start with caring families.'],
      cta: 'Scan for our branches · Klinik Putrijaya' },
    ms: { date: '20 NOVEMBER', day: 'Hari Kanak-kanak Sedunia', h: 'Setiap kanak-kanak, setiap hak',
      lines: ['20 November ialah Hari Kanak-kanak Sedunia.', 'Tema tahun ini: "My Day. My Rights. My Future."', 'Kanak-kanak sihat dan gembira bermula dengan keluarga penyayang.'],
      cta: 'Imbas untuk cawangan kami · Klinik Putrijaya' } },
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function poster(p, l) {
  const x = p[l];
  const dayLen = x.day.length;
  const daySize = dayLen > 30 ? 56 : dayLen > 22 ? 74 : 84;
  const lines = x.lines.map((t, i) => `<div class="card line">${ico(p.icons[i], 60)}<span>${esc(t)}</span></div>`).join('');
  return blobs([[640, -260, 720, P1], [-260, 760, 520, P2], [840, 600, 360, P1]]) + `
<div class="wrap">
 <img class="logo" src="${LOGO}">
 <div class="mid">
 <div style="text-align:center"><span class="pill">${x.date} 2026</span></div>
 <div class="script" style="text-align:center;font-size:${daySize}px;line-height:1.15;margin-top:6px">${esc(x.day)}</div>
 <div style="text-align:center;font-weight:900;font-size:${p.hs[l]}px;line-height:1.04;margin-top:6px">${esc(x.h)}</div>
 <div style="display:flex;flex-direction:column;gap:16px;margin-top:30px;background:${P1};padding:16px;border-radius:28px">${lines}</div>
 <div class="cta" style="margin-top:28px">${esc(x.cta)}</div>
 <div class="src">${T[l].src}: ${p.source}</div>
 </div>
 ${footer(l)}
</div>`;
}

for (const [name, p] of Object.entries(POSTERS)) {
  for (const l of ['en', 'ms']) {
    const html = `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>${name}-${l}</title><style>${CSS}</style></head><body>${poster(p, l)}</body></html>`;
    fs.writeFileSync(path.join(HERE, `${name}-${l}.html`), html);
    console.log('wrote', `${name}-${l}.html`);
  }
}

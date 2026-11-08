// Klinik Putrijaya — Deepavali greeting, Sun 8 Nov 2026 (EN + MS).
// Copy: content/2026-11/november-brief.md "Deepavali greeting" (Iman), word for word. No hours footer (holiday hours unconfirmed).
// Motifs: oil lamps (diya), soft light, sparkles and a simple kolam-style medallion, drawn as shapes. No photos or deity imagery.
// Run: node posters-src/november/deepavali.mjs → deepavali-<lang>.html here; render with headless Chrome.
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
const FONTS = [500, 600, 700, 900].map(w => ff('Poppins', `poppins/files/poppins-latin-${w}-normal.woff2`, w)).join('')
  + ff('Great Vibes', 'great-vibes/files/great-vibes-latin-400-normal.woff2', 400);

const CSS = FONTS + `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;font-family:Poppins,sans-serif;color:${K};background:${W};position:relative;overflow:hidden}
.blob{position:absolute;border-radius:50%;z-index:0}
.deco{position:absolute;z-index:0}
.wrap{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;padding:56px 64px 0}
.logo{height:78px;display:block;margin:0 auto}
.script{font-family:'Great Vibes',cursive;font-weight:400}
.mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-bottom:10px}
.foot{margin:0 -64px;background:${P1};border-top:3px solid ${P3};padding:22px 64px 24px;display:flex;gap:28px;align-items:center;justify-content:space-between}
.qr{display:flex;align-items:center;gap:16px;font-weight:700;font-size:21px}
.qr img{width:104px;height:104px;display:block;background:${W};border:3px solid ${P3};border-radius:14px;padding:7px}
`;

const blobs = specs => specs.map(([x, y, s, c]) => `<div class="blob" style="width:${s}px;height:${s}px;left:${x}px;top:${y}px;background:${c}"></div>`).join('');

// 4-point sparkle
const spark = (x, y, s, fill = W) => `<svg class="deco" style="left:${x}px;top:${y}px" width="${s}" height="${s}" viewBox="0 0 40 40"><path d="M20 0C21.5 13 27 18.5 40 20C27 21.5 21.5 27 20 40C18.5 27 13 21.5 0 20C13 18.5 18.5 13 20 0Z" fill="${fill}" stroke="${K}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

// Kolam-style medallion: petal rings and dots, palette pinks with a black line
function kolam(size) {
  const c = 100;
  const ring = (n, r, rx, ry, fill, rot = 0) => Array.from({ length: n }, (_, i) => {
    const a = (360 / n) * i + rot;
    return `<ellipse cx="${c}" cy="${c - r}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${c} ${c})" fill="${fill}" stroke="${K}" stroke-width="1.4"/>`;
  }).join('');
  const dots = (n, r, d, fill) => Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI / n) * i;
    return `<circle cx="${(c + r * Math.sin(a)).toFixed(2)}" cy="${(c - r * Math.cos(a)).toFixed(2)}" r="${d}" fill="${fill}" stroke="${K}" stroke-width="1.1"/>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 200 200">
    <circle cx="${c}" cy="${c}" r="96" fill="${P1}"/>
    ${dots(32, 90, 3.2, W)}
    ${ring(16, 66, 9, 18, P2, 11.25)}
    ${ring(8, 46, 13, 26, P3)}
    <circle cx="${c}" cy="${c}" r="24" fill="${W}" stroke="${K}" stroke-width="1.4"/>
    ${dots(8, 15, 3, P3)}
    <circle cx="${c}" cy="${c}" r="6" fill="${P3}" stroke="${K}" stroke-width="1.2"/>
  </svg>`;
}

// Oil lamp (diya) with flame and soft glow
function diya(w) {
  return `<svg width="${w}" height="${w}" viewBox="0 0 200 200">
    <defs><radialGradient id="g${w}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${W}"/><stop offset=".45" stop-color="${P1}"/><stop offset="1" stop-color="${P1}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="100" cy="78" r="78" fill="url(#g${w})"/>
    <path d="M100 26C88 50 82 62 82 76a18 18 0 0 0 36 0c0-14-6-26-18-50z" fill="${P2}" stroke="${K}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M100 52C94 64 92 70 92 77a8 8 0 0 0 16 0c0-7-2-13-8-25z" fill="${W}" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M100 96v10" stroke="${K}" stroke-width="4" stroke-linecap="round"/>
    <path d="M22 112h132l26-14c-4 22-14 34-28 42-14 22-34 32-52 32s-38-10-52-32c-14-8-22-18-26-28z" fill="${P3}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M44 132q56 22 112 0" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="72" cy="150" r="4" fill="${W}" stroke="${K}" stroke-width="2"/><circle cx="100" cy="156" r="4" fill="${W}" stroke="${K}" stroke-width="2"/><circle cx="128" cy="150" r="4" fill="${W}" stroke="${K}" stroke-width="2"/>
    <path d="M70 188h60" stroke="${K}" stroke-width="4" stroke-linecap="round"/>
    <path d="M78 172l-6 16M122 172l6 16" stroke="${K}" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}

const COPY = {
  en: { script: 'Happy', big: 'Deepavali', wish: 'May your home be filled with light, joy and togetherness.', sign: 'From all of us at Klinik Putrijaya', scan: 'Scan for our branches' },
  ms: { script: 'Selamat Hari', big: 'Deepavali', wish: 'Semoga rumah anda dipenuhi cahaya, kegembiraan dan kebersamaan.', sign: 'Daripada kami semua di Klinik Putrijaya', scan: 'Imbas untuk cawangan kami' },
};

function poster(l) {
  const x = COPY[l];
  const sparks = [[90, 300, 34], [960, 250, 42], [150, 560, 24], [900, 520, 28], [70, 860, 30], [975, 820, 36], [520, 236, 20, P3]]
    .map(([a, b, s, f]) => spark(a, b, s, f)).join('');
  return blobs([[660, -300, 700, P1], [-280, 860, 520, P2]]) + sparks + `
<div class="wrap">
 <img class="logo" src="${LOGO}">
 <div class="mid">
  ${kolam(220)}
  <div class="script" style="font-size:${l === 'en' ? 140 : 118}px;line-height:1.05;margin-top:10px">${x.script}</div>
  <div style="font-weight:900;font-size:124px;line-height:1;letter-spacing:3px;text-transform:uppercase">${x.big}</div>
  <div style="font-size:35px;font-weight:500;line-height:1.35;max-width:860px;margin-top:24px">${x.wish}</div>
  <div style="display:flex;align-items:flex-end;justify-content:center;gap:34px;margin-top:22px">${diya(150)}${diya(190)}${diya(150)}</div>
 </div>
 <div class="foot">
  <div style="font-weight:700;font-size:27px;line-height:1.25;white-space:nowrap">${x.sign}</div>
  <div class="qr"><span style="text-align:right;max-width:215px;line-height:1.25">${x.scan}</span><img src="${QR}"></div>
 </div>
</div>`;
}

for (const l of ['en', 'ms']) {
  const html = `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><title>deepavali-${l}</title><style>${CSS}</style></head><body>${poster(l)}</body></html>`;
  fs.writeFileSync(path.join(HERE, `deepavali-${l}.html`), html);
  console.log('wrote', `deepavali-${l}.html`);
}

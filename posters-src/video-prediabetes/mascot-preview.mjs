// Builds mascot-preview.html: the mascot in its four states, for Chrome to render to mascot-preview.png.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const svg = fs.readFileSync(path.join(HERE, 'mascot.svg'), 'utf8');
const font = f => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', f)).toString('base64');
const states = [
  ['Mouth closed', { 'mouth-closed': 1 }], ['Mouth half', { 'mouth-half': 1 }], ['Mouth open', { 'mouth-open': 1 }], ['Blink', { 'mouth-closed': 1, blink: 1 }],
];
const cell = ([label, s]) => {
  let v = svg.replace(/<svg [^>]*>/, '<svg viewBox="0 0 400 480" width="340" height="408">');
  for (const m of ['closed', 'half', 'open']) v = v.replace(`id="mouth-${m}"`, `id="mouth-${m}" style="display:${s['mouth-' + m] ? 'inline' : 'none'}"`).replace(/(id="mouth-\w+" style="display:\w+") (?:fill="none" )?(stroke-width="\d") style="display:none"/, '$1 $2');
  v = v.replace('id="eyes-open"', `id="eyes-open" style="display:${s.blink ? 'none' : 'inline'}"`).replace('id="eyes-blink" fill="none" stroke-width="6" style="display:none"', `id="eyes-blink" fill="none" stroke-width="6" style="display:${s.blink ? 'inline' : 'none'}"`);
  return `<div class="c">${v}<p>${label}</p></div>`;
};
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Poppins;font-weight:600;src:url(${font('poppins/files/poppins-latin-600-normal.woff2')})}
@font-face{font-family:Poppins;font-weight:900;src:url(${font('poppins/files/poppins-latin-900-normal.woff2')})}
@font-face{font-family:'Great Vibes';src:url(${font('great-vibes/files/great-vibes-latin-400-normal.woff2')})}
*{margin:0;box-sizing:border-box}body{width:1600px;height:720px;background:#fddbec;font-family:Poppins;display:flex;flex-direction:column;align-items:center;justify-content:center}
h1{font-family:'Great Vibes';font-weight:400;font-size:96px;line-height:1}h2{font-weight:600;font-size:22px;letter-spacing:2px;margin:6px 0 18px}
.row{display:flex;gap:28px}.c{background:#fff;border:3px solid #f9a6d0;border-radius:28px;padding:16px 14px 10px;text-align:center}.c p{font-weight:600;font-size:22px}
</style></head><body><h1>Ceria</h1><h2>KLINIK PUTRIJAYA MASCOT · WORKING NAME, PENDING AIN'S APPROVAL</h2><div class="row">${states.map(cell).join('')}</div></body></html>`;
fs.writeFileSync(path.join(HERE, 'mascot-preview.html'), html);
console.log('wrote mascot-preview.html');

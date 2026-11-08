// Prediabetes awareness video (Klinik Putrijaya), 1080×1920, ~47 s.
// Script: content/2026-11/november-brief.md "Prediabetes video" (Iman), word for word. Facts: US CDC (Sara).
// One timeline drives everything: this script writes video.html (Arjun) and captions.vtt (Chloe).
// video.html plays in real time, or renders one frame with ?t=<seconds> (for frame-by-frame MP4 export later).
// Run: node posters-src/video-prediabetes/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const b64 = (p, mime) => `data:${mime};base64,` + fs.readFileSync(path.join(ROOT, p)).toString('base64');

// Beats: moving text from the brief and the mascot's line split into caption cues (verbatim script).
// Timing comes from the voice: audio/beat<n>.wav (Microsoft Zira Desktop, rate -1, made with System.Speech).
const SCRIPT = [
  { n: 1, text: 'High sugar, no signs?', wave: true, cues: ['Did you know your blood sugar can be high…', 'without you feeling it?'] },
  { n: 2, text: 'What is prediabetes?', cues: ["That's called prediabetes.", 'Your blood sugar is higher than normal, but not yet type 2 diabetes.'] },
  { n: 3, text: 'Often no symptoms', cues: ['You can have it for years, with no clear symptoms.'] },
  { n: 4, text: 'Know your risk', cues: ["Your risk is higher if you're overweight, 45 or older,", 'or have a parent, brother or sister with type 2 diabetes.'] },
  { n: 5, text: 'Healthy changes help', cues: ['The good news?', 'Healthy changes can cut your risk of type 2 diabetes in half.'] },
  { n: 6, text: 'Move 150 min a week', cues: ['Try at least 150 minutes of brisk walking a week.', 'Losing just 5 to 7 percent of your weight helps too.'] },
  { n: 7, text: 'One simple test', cues: ['And a simple blood sugar test can tell you where you stand.'] },
  { n: 8, text: 'Get your blood sugar checked at Klinik Putrijaya', wave: true, endCard: true, cues: ['Get your blood sugar checked at Klinik Putrijaya.', 'See you soon!'] },
];

const SR = 24000, FPS = 30, LEAD = 0.5, GAP = 0.45, TAIL = 1.3, THRESH = 500;
function readWav(n) {
  const b = fs.readFileSync(path.join(HERE, 'audio', `beat${n}.wav`));
  const off = b.indexOf('data') + 8, len = (b.length - off) >> 1, s = new Int16Array(len);
  for (let k = 0; k < len; k++) s[k] = b.readInt16LE(off + k * 2);
  let f = 0, l = len - 1;
  while (f < len && Math.abs(s[f]) < THRESH) f++;
  while (l > f && Math.abs(s[l]) < THRESH) l--;
  const pad = Math.round(0.04 * SR);
  return s.slice(Math.max(0, f - pad), Math.min(len, l + pad));
}
// Pause inside a clip nearest the target time (for splitting a beat into two caption cues).
function pauseNear(s, target) {
  const win = Math.round(0.02 * SR), quiet = [];
  for (let k = 0; k + win < s.length; k += win) { let m = 0; for (let j = k; j < k + win; j++) m = Math.max(m, Math.abs(s[j])); quiet.push(m < THRESH); }
  let best = target, bestD = Infinity;
  for (let i = 0; i < quiet.length; i++) {
    if (!quiet[i]) continue;
    let j = i; while (j < quiet.length && quiet[j]) j++;
    if (j - i >= 5) { const mid = ((i + j) / 2) * win / SR, d = Math.abs(mid - target); if (d < bestD) { bestD = d; best = mid; } }
    i = j;
  }
  return best;
}

const clips = SCRIPT.map(b => readWav(b.n));
let cursor = LEAD;
export const BEATS = SCRIPT.map((b, i) => {
  const s = clips[i], dur = s.length / SR, start = cursor, end = start + dur;
  cursor = end + GAP;
  let cues;
  if (b.cues.length === 1) cues = [[start, end + 0.25, b.cues[0]]];
  else {
    const frac = b.cues[0].length / (b.cues[0].length + b.cues[1].length);
    const split = start + pauseNear(s, dur * frac);
    cues = [[start, split, b.cues[0]], [split, end + 0.25, b.cues[1]]];
  }
  return { ...b, start: +start.toFixed(3), end: +end.toFixed(3), cues: cues.map(([a, z, t]) => [+a.toFixed(3), +z.toFixed(3), t]) };
});
export const END_CARD_AT = BEATS[7].start;
export const DURATION = +(BEATS[7].end + TAIL).toFixed(3);

// Full voice track (24 kHz mono 16-bit) and a per-frame loudness envelope for the mouth.
const total = Math.ceil(DURATION * SR), track = new Int16Array(total);
BEATS.forEach((b, i) => track.set(clips[i], Math.round(b.start * SR)));
function writeWav(file, samples) {
  const h = Buffer.alloc(44), data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
const per = SR / FPS, ENV = [];
let peak = 1;
for (let f = 0; f * per < total; f++) { let sum = 0, n = 0; for (let k = Math.round(f * per); k < Math.min(total, Math.round((f + 1) * per)); k++) { sum += track[k] * track[k]; n++; } const r = Math.sqrt(sum / Math.max(1, n)); ENV.push(r); peak = Math.max(peak, r); }
const ENVN = ENV.map(v => +(v / peak).toFixed(2));

const vttTime = s => {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
};

function buildVtt() {
  const lines = ['WEBVTT', '', 'NOTE Klinik Putrijaya prediabetes video. Script: november-brief.md (Iman). Source: US CDC. Timed to audio/voice.wav (Microsoft Zira Desktop, rate -1).', ''];
  let i = 1;
  for (const b of BEATS) for (const [s, e, t] of b.cues) lines.push(String(i++), `${vttTime(s)} --> ${vttTime(e)}`, t, '');
  return lines.join('\n');
}

function buildHtml() {
  const svg = fs.readFileSync(path.join(HERE, 'mascot.svg'), 'utf8').replace(/<svg [^>]*>/, '<svg viewBox="0 0 400 480" width="100%" height="100%">').replace(/<!--[\s\S]*?-->/g, '');
  const font = (fam, f, w) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(${b64(`node_modules/@fontsource/${f}`, 'font/woff2')}) format('woff2')}`;
  const FONTS = [500, 600, 800, 900].map(w => font('Poppins', `poppins/files/poppins-latin-${w}-normal.woff2`, w)).join('') + font('Great Vibes', 'great-vibes/files/great-vibes-latin-400-normal.woff2', 400);
  const DATA = JSON.stringify({ DURATION, END_CARD_AT, BEATS, FPS, ENV: ENVN });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Prediabetes video</title><style>${FONTS}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#fddbec}
body{font-family:Poppins,sans-serif;color:#000;position:relative}
#bg{position:absolute;inset:0;overflow:hidden}
.row{position:absolute;left:0;white-space:nowrap;font-weight:900;font-size:150px;line-height:1;letter-spacing:2px;will-change:transform}
#logo{position:absolute;top:236px;left:50%;transform:translateX(-50%);background:#fff;border:4px solid #f9a6d0;border-radius:999px;padding:18px 44px}
#logo img{height:76px;display:block}
#chip{position:absolute;top:390px;left:60px;right:60px;text-align:center}
#chip span{display:inline-block;background:#000;color:#fff;font-weight:800;font-size:64px;line-height:1.15;border-radius:40px;padding:18px 44px;max-width:960px}
#mascot{position:absolute;width:520px;height:624px;left:280px;top:570px;transform-origin:50% 100%}
#subs{position:absolute;left:60px;right:60px;top:1210px;height:270px;display:flex;align-items:flex-end;justify-content:center}
#subs span{background:#fff;border:4px solid #f9a6d0;border-radius:32px;padding:20px 34px;font-weight:600;font-size:52px;line-height:1.3;text-align:center;max-width:960px}
#src{position:absolute;top:1490px;left:0;right:0;text-align:center;font-weight:500;font-size:28px;line-height:40px}
#card{position:absolute;left:70px;right:70px;top:200px;background:#fff;border:5px solid #f9a6d0;border-radius:56px;display:flex;flex-direction:column;align-items:center;padding:56px 60px 40px;text-align:center}
#card .lg{height:110px}
#card h1{font-weight:900;font-size:72px;line-height:1.1;margin-top:44px}
#card .scan{font-weight:700;font-size:38px;letter-spacing:1px;margin-top:36px}
#card .qr{width:340px;height:340px;margin-top:18px;border:5px solid #f9a6d0;border-radius:28px;padding:14px;background:#fff}
#card .s{font-weight:500;font-size:28px;margin-top:24px}
</style></head><body>
<div id="bg"></div>
<div id="logo"><img src="${b64('assets/logo.png', 'image/png')}" alt="Klinik Putrijaya"></div>
<div id="chip"><span></span></div>
<div id="card"><img class="lg" src="${b64('assets/logo.png', 'image/png')}" alt="Klinik Putrijaya"><h1>Get your blood sugar checked at Klinik Putrijaya</h1><div class="scan">Scan for our branches</div><img class="qr" src="${b64('assets/qr.png', 'image/png')}" alt="QR"><div class="s">Source: US CDC</div></div>
<div id="mascot">${svg}</div>
<div id="subs"><span></span></div>
<div id="src">Source: US CDC</div>
<script>
const {DURATION, END_CARD_AT, BEATS, FPS, ENV} = ${DATA};
const env = t => ENV[Math.min(ENV.length - 1, Math.max(0, Math.floor(t * FPS)))] || 0;
const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const ROW_COLORS = ['#f9a6d0', '#ffffff', '#fdcae3', '#f9a6d0', '#ffffff', '#fdcae3', '#f9a6d0', '#ffffff', '#fdcae3', '#f9a6d0', '#ffffff', '#fdcae3'];
const ROWS = ROW_COLORS.map((c, i) => { const d = document.createElement('div'); d.className = 'row'; d.style.top = (i * 165 - 20) + 'px'; d.style.color = c; $('#bg').appendChild(d); return d; });
let rowText = null, rowHalf = 0;
function beatAt(t) { let b = BEATS[0]; for (const x of BEATS) if (t >= x.start - 0.3) b = x; return b; }
function cueAt(t) { for (const b of BEATS) for (const [s, e, txt] of b.cues) if (t >= s && t < e) return txt; return ''; }
function speaking(t) { return BEATS.some(b => t >= b.start && t < b.end); }
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function show(id, on) { const el = document.getElementById(id); if (el) el.style.display = on ? 'inline' : 'none'; }
function renderFrame(t) {
  t = clamp(t, 0, DURATION);
  const b = beatAt(t), since = t - (b.start - 0.3);
  // Moving background text: the beat's line, repeated, rows sliding in alternate directions.
  const marquee = (b.text + '  •  ').repeat(6);
  if (rowText !== marquee) { ROWS.forEach(r => r.textContent = marquee + marquee); rowText = marquee; rowHalf = ROWS[0].scrollWidth / 2; }
  const fade = ease(since / 0.5);
  ROWS.forEach((r, i) => { const dir = i % 2 ? 1 : -1, speed = 90 + (i % 3) * 35; let x = (t * speed + i * 377) % rowHalf; x = dir < 0 ? -x : x - rowHalf; r.style.transform = 'translateX(' + x + 'px)'; r.style.opacity = (0.9 * fade).toFixed(3); });
  // Keyword chip
  const end = t >= END_CARD_AT, ec = ease((t - END_CARD_AT) / 0.7);
  const chip = $('#chip span'); chip.textContent = b.text; const pop = ease(since / 0.35);
  $('#chip').style.opacity = b.endCard ? 0 : pop.toFixed(3); /* end card already shows this line */ chip.style.transform = 'scale(' + (0.85 + 0.15 * pop).toFixed(3) + ')';
  // Captions
  const cue = cueAt(t); $('#subs span').textContent = cue; $('#subs').style.opacity = cue ? 1 : 0; $('#subs').style.right = (60 + 300 * ec).toFixed(1) + 'px'; // end card: captions left, mascot bottom right
  // End card
  $('#card').style.opacity = ec.toFixed(3); $('#card').style.transform = 'translateY(' + ((1 - ec) * 120).toFixed(1) + 'px)';
  $('#logo').style.opacity = (1 - ec).toFixed(3); $('#src').style.opacity = (1 - ec).toFixed(3);
  // Mascot: bob, move to the corner for the end card, talk, blink, wave.
  const bob = Math.sin(t * 2.6) * 12, squash = 1 + 0.03 * Math.sin(t * 5.2) * (speaking(t) ? 1 : 0.3);
  const sc = 1 - 0.56 * ec, dx = 375 * ec, dy = 290 * ec;
  $('#mascot').style.transform = 'translate(' + dx.toFixed(1) + 'px,' + (bob + dy).toFixed(1) + 'px) scale(' + (sc * (2 - squash)).toFixed(3) + ',' + (sc * squash).toFixed(3) + ')';
  let mouth = 'closed';
  { const a = Math.max(env(t), env(t - 1 / FPS) * 0.6); mouth = a < 0.06 ? 'closed' : a < 0.28 ? 'half' : 'open'; } // mouth follows the voice loudness
  show('mouth-closed', mouth === 'closed'); show('mouth-half', mouth === 'half'); show('mouth-open', mouth === 'open');
  const ph = (t + 0.7) % 3.4, blink = ph < 0.13; show('eyes-open', !blink); show('eyes-blink', blink);
  const waving = b.wave && since < 3.2 ? Math.sin(since * 9) * 22 : 0;
  const arm = document.getElementById('arm-left'); if (arm) arm.style.transform = 'rotate(' + waving.toFixed(1) + 'deg)';
  document.body.dataset.t = t.toFixed(3);
}
window.renderFrame = renderFrame; window.DURATION = DURATION;
const q = new URLSearchParams(location.search);
document.fonts.ready.then(() => {
  rowText = null;
  if (q.has('t')) { renderFrame(parseFloat(q.get('t')) || 0); document.body.dataset.ready = '1'; return; }
  const t0 = performance.now();
  const loop = now => { renderFrame(((now - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
renderFrame(q.has('t') ? parseFloat(q.get('t')) || 0 : 0);
</script></body></html>`;
}

fs.writeFileSync(path.join(HERE, 'captions.vtt'), buildVtt());
fs.writeFileSync(path.join(HERE, 'video.html'), buildHtml());
writeWav(path.join(HERE, 'audio', 'voice.wav'), track);
console.log('duration', DURATION, 'end card at', END_CARD_AT, BEATS.map(b => b.n + ':' + b.start + '-' + b.end).join(' '));
console.log('wrote captions.vtt, video.html');

// Renders video.html to PNG frames (1080×1920, 30 fps) with one headless Chrome over the DevTools protocol.
// Usage: node render.mjs <outDir> [fps] [only=t1,t2,...]
// Then mux with ffmpeg (see storyboard.md "Export").
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out-frames'));
const FPS = Number(process.argv[3] || 30);
const ONLY = (process.argv.find(a => a.startsWith('only=')) || '').slice(5).split(',').filter(Boolean).map(Number);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333 + Math.floor(Math.random() * 500);
fs.mkdirSync(OUT, { recursive: true });

const url = pathToFileURL(path.join(HERE, 'video.html')).href + '?t=0';
const profile = path.join(OUT, '..', 'chrome-profile-render');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1080,1920', url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let page;
for (let i = 0; i < 100 && !page; i++) {
  await sleep(200);
  try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); page = list.find(p => p.type === 'page' && p.url.startsWith('file:')); } catch {}
}
if (!page) { chrome.kill(); throw new Error('Chrome page not found'); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
for (let i = 0; i < 100; i++) { if (await evaluate("document.body && document.body.dataset.ready === '1'")) break; await sleep(100); }
const duration = await evaluate('window.DURATION');
const times = ONLY.length ? ONLY : Array.from({ length: Math.round(duration * FPS) }, (_, f) => f / FPS);
const t0 = Date.now();
for (let i = 0; i < times.length; i++) {
  await evaluate(`renderFrame(${times[i]}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920, scale: 1 } });
  const name = ONLY.length ? `t${String(times[i]).replace('.', '_')}.png` : `f${String(i).padStart(5, '0')}.png`;
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'));
  if (i % 150 === 0) console.log(`frame ${i}/${times.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
console.log(`done: ${times.length} frames, duration ${duration} s, in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${OUT}`);
ws.close(); chrome.kill();

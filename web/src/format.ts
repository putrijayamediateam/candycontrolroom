export const TZ = 'Asia/Kuala_Lumpur';

const loc = (l: string) => (l === 'ms' ? 'ms-MY' : 'en-MY');

export function fmtDateTime(at: string | Date | null | undefined, l = 'en') {
  if (!at) return '—';
  return new Intl.DateTimeFormat(loc(l), { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at));
}
export function fmtTime(at: string | Date, l = 'en') {
  return new Intl.DateTimeFormat(loc(l), { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(at));
}
export function fmtLongDate(at: string | Date, l = 'en') {
  return new Intl.DateTimeFormat(loc(l), { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(at));
}
/** Malaysia business date YYYY-MM-DD. */
export function myDate(at: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}
export function myHour(at: Date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(at));
}
export function remaining(until: string | Date, now = Date.now()) {
  const ms = Math.max(0, new Date(until).getTime() - now);
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
}
/** Event targets can be record ids; show a short reference instead of a raw UUID. */
export const shortTarget = (t: string | null | undefined) =>
  !t ? '' : /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t) ? `#${t.slice(0, 8)}` : t;
/** Asset keys are stored relative to the project (assets/...); the API serves them under /api/assets/. */
export const assetUrl = (key: string) => `/api/assets/${key.replace(/^assets\//, '')}`;
export const isImage = (key: string) => /\.(png|jpe?g|webp|gif|svg)$/i.test(key);
export const isVideo = (key: string) => /\.(mp4|webm)$/i.test(key);

export const CLINIC_TZ = 'Asia/Kuala_Lumpur';

/** Malaysia business date (YYYY-MM-DD) for an instant. */
export function myDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Compact form for IDs: YYYYMMDD */
export function myDateCompact(at: Date = new Date()): string {
  return myDate(at).replaceAll('-', '');
}

/** Build a UTC instant from a Malaysia date + HH:MM slot. Malaysia has no DST (UTC+8). */
export function slotInstant(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+08:00`);
}

export function formatMy(at: Date, locale: 'en' | 'ms' = 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ms' ? 'ms-MY' : 'en-MY', {
    timeZone: CLINIC_TZ, dateStyle: 'medium', timeStyle: 'short',
  }).format(at);
}

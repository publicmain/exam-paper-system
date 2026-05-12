/**
 * Asia/Shanghai date/time formatters.
 *
 * Bug 10: browser-locale renderings (toLocaleString, toISOString().slice(0,10))
 * showed wrong wall-clock times for VPN/foreign-locale students and rolled the
 * "today" boundary at UTC midnight instead of CN midnight. These helpers force
 * Asia/Shanghai regardless of the browser locale or system clock TZ, by using
 * Intl.DateTimeFormat with timeZone: 'Asia/Shanghai'. Null/empty inputs render
 * as '—' so callers don't need to guard every call site.
 */
const TZ = 'Asia/Shanghai';

function toDate(input: string | Date | null | undefined): Date | null {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** "YYYY-MM-DD HH:MM:SS" in CN time. */
export function formatCNDateTime(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '—';
  const date = formatCNDate(d);
  const time = formatCNTime(d);
  return `${date} ${time}`;
}

/** "YYYY-MM-DD" in CN time. en-CA happens to be ISO-formatted. */
export function formatCNDate(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** "HH:MM:SS" in CN time (24-hour). */
export function formatCNTime(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d);
}

/** CN-local YYYY-MM-DD (does NOT use UTC .toISOString). */
export function cnDateISO(d: Date = new Date()): string {
  return formatCNDate(d);
}

/** Monday-of-this-week as YYYY-MM-DD, computed in CN time. */
export function cnMondayISO(d: Date = new Date()): string {
  // Pull CN-local Y/M/D so day-of-week math doesn't drift across the UTC
  // boundary (e.g. Sun 23:30 UTC in CN is Mon 07:30 — browser getDay() lies).
  const iso = cnDateISO(d); // YYYY-MM-DD in CN time
  const [y, m, day] = iso.split('-').map(Number);
  // Construct a UTC date at noon to dodge DST artefacts; getUTCDay() is then
  // the day-of-week for the CN calendar date.
  const probe = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  const dow = probe.getUTCDay(); // 0=Sun, 1=Mon
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  probe.setUTCDate(probe.getUTCDate() - daysSinceMon);
  const yy = probe.getUTCFullYear();
  const mm = String(probe.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(probe.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

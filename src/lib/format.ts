/**
 * Dates are stored as local "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" strings so a
 * 5:30 pm practice stays 5:30 pm wherever the coach opens it.
 */
export const parseLocal = (s: string) => new Date(s.length === 10 ? `${s}T00:00` : s.replace(' ', 'T'));

const pad = (n: number) => String(n).padStart(2, '0');
export const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toLocalDateTime = (d: Date) => `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const todayStr = () => toLocalDate(new Date());

export function fmtDate(s?: string | null, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  if (!s) return '—';
  return parseLocal(s).toLocaleDateString(undefined, opts);
}
export const fmtDateLong = (s?: string | null) => fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
export function fmtTime(s?: string | null) {
  if (!s || s.length <= 10) return '';
  return parseLocal(s).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export const fmtDateTime = (s?: string | null) => (s ? `${fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric' })}${fmtTime(s) ? ` · ${fmtTime(s)}` : ''}` : '—');

export function relDays(s: string) {
  const d = parseLocal(s.slice(0, 10));
  const t = parseLocal(todayStr());
  const n = Math.round((d.getTime() - t.getTime()) / 864e5);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

export const playerName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
export const pct = (n: number) => `${Math.round(n)}%`;

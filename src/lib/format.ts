export function fmt(n: number | null, dec = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(dec);
}

export function signed(n: number | null, dec = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  const s = n.toFixed(dec);
  return n > 0 ? `+${s}` : s;
}

export function pct(x: number | null, dec = 0): string {
  if (x == null || Number.isNaN(x)) return '—';
  return `${(x * 100).toFixed(dec)}%`;
}

export function dash<T>(v: T | null): T | '—' {
  return v == null ? '—' : v;
}

// fbref times are Europe/London wall clock; dashboard audience is UTC+7.
const BKK_TZ = 'Asia/Bangkok';
const LDN_TZ = 'Europe/London';

const wallFmt = new Map<string, Intl.DateTimeFormat>();
function wallFmtFor(tz: string) {
  let f = wallFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    wallFmt.set(tz, f);
  }
  return f;
}

// minutes a zone is ahead of UTC at the given UTC instant
function tzOffsetMin(tz: string, utcMs: number): number {
  const parts = wallFmtFor(tz).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'),
    get('hour') % 24, get('minute'), get('second'));
  return Math.round((wall - utcMs) / 60000);
}

/** Convert a London wall-clock date+time to Bangkok; null if unparseable. */
export function bkkKickoff(
  dateISO: string,
  time: string | null | undefined,
): { date: string; time: string } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((time ?? '').trim());
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO ?? '');
  if (!m || !dm) return null;
  const wallUTC = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +m[1], +m[2]);
  // solve utc s.t. Europe/London wall time == wallUTC (handles BST/GMT)
  let utc = wallUTC;
  for (let i = 0; i < 3; i++) {
    utc = wallUTC - tzOffsetMin(LDN_TZ, utc) * 60000;
  }
  const bkkWall = utc + tzOffsetMin(BKK_TZ, utc) * 60000;
  const d = new Date(bkkWall);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).slice(2)}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}

export function gbp(n: number | null, dec = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: dec,
  }).format(n);
}

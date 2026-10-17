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

export function gbp(n: number | null, dec = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: dec,
  }).format(n);
}

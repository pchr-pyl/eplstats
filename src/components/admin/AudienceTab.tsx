'use client';

import { Card, thaiTime } from './UsageTab';
import type { Stats } from './types';

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['th'], { type: 'region' });
  } catch {
    return null;
  }
})();

const countryName = (code: string) => {
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

function Breakdown({
  title,
  rows,
  label,
}: {
  title: string;
  rows: { k: string; n: number; v: number }[];
  label: (k: string) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Card title={title}>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center gap-2">
            <span className="w-28 truncate text-sm text-secondary" title={label(r.k)}>
              {label(r.k)}
            </span>
            <span className="h-4 min-w-1 flex-1 overflow-hidden rounded bg-bg-secondary">
              <span
                className="block h-full rounded-sm"
                style={{ width: `${(r.n / max) * 100}%`, background: 'var(--brand)' }}
              />
            </span>
            <span className="w-16 text-right text-sm tabular-nums text-primary">{r.n} วิว</span>
            <span className="w-24 text-right text-xs tabular-nums text-muted">
              {r.v} ผู้เข้าชม·วัน
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">—</p>}
      </div>
    </Card>
  );
}

const DEVICE_TH: Record<string, string> = {
  desktop: 'เดสก์ท็อป',
  mobile: 'มือถือ',
  tablet: 'แท็บเล็ต',
};
const LANG_TH: Record<string, string> = { th: 'ไทย', en: 'English' };
const THEME_TH: Record<string, string> = { dark: 'โหมดมืด', light: 'โหมดสว่าง' };

export function AudienceTab({ stats }: { stats: Stats }) {
  if (!stats.totals?.trackedSince) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="text-secondary">
          ยังไม่มีข้อมูล — เริ่มเก็บหลัง deploy เวอร์ชันนี้
        </p>
      </section>
    );
  }
  return (
    <>
      <p className="text-xs text-muted">
        30 วันล่าสุด · เริ่มเก็บข้อมูลผู้เข้าชมตั้งแต่ {thaiTime(stats.totals.trackedSince, false)}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="อุปกรณ์" rows={stats.audience.device} label={(k) => DEVICE_TH[k] ?? k} />
        <Breakdown title="ประเทศ" rows={stats.audience.country} label={countryName} />
        <Breakdown title="ภาษา" rows={stats.audience.lang} label={(k) => LANG_TH[k] ?? k} />
        <Breakdown title="ธีม" rows={stats.audience.theme} label={(k) => THEME_TH[k] ?? k} />
      </div>
    </>
  );
}

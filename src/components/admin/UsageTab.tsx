'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmt, pct, signed } from '@/lib/format';
import type { Stats } from './types';
import type { SiteStats } from '@/lib/siteStats';

export const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
    <h2 className="mb-3 font-display text-lg font-semibold text-primary">{title}</h2>
    {children}
  </section>
);

/** 'YYYY-MM-DD HH:MM:SS' (UTC) → Thai local date-time string. */
export function thaiTime(s: string, withTime = true): string {
  const d = new Date(`${s.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : { year: '2-digit' }),
  });
}

const DOW_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

const SECTION_TH: Record<string, string> = {
  home: 'หน้าแรก',
  overview: 'ภาพรวม',
  matches: 'สกอร์และโปรแกรม',
  attack: 'เกมรุก',
  defense: 'เกมรับ',
  misc: 'สถิติอื่นๆ',
  squad: 'นักเตะ',
  managers: 'ผู้จัดการ',
  compare: 'เปรียบเทียบ',
  'clubs-compare': 'เปรียบเทียบสโมสร',
};

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-primary">{value}</div>
      {sub != null && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

function BarList({
  rows,
  label,
  nKey,
}: {
  rows: { k: string; n: number; sub?: string }[];
  label: (k: string) => string;
  nKey?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
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
          <span className="w-14 text-right text-sm tabular-nums text-primary">{r.n}</span>
          {r.sub && <span className="w-20 text-right text-xs tabular-nums text-muted">{r.sub}</span>}
          {nKey && <span className="sr-only">{nKey}</span>}
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted">—</p>}
    </div>
  );
}

export function UsageTab({ stats, site }: { stats: Stats; site: SiteStats | null }) {
  const t = stats.totals;
  const wow =
    t && t.viewsPrev7d > 0 ? (t.views7d - t.viewsPrev7d) / t.viewsPrev7d : null;

  // 30-day chart: fill missing Thai days with 0 (today in UTC+7)
  const [todayMs] = useState(() => Date.now() + 7 * 3600_000);
  const chartData = useMemo(() => {
    const dayMap = new Map(stats.byDay.map((d) => [d.day, d]));
    const rows: { day: string; n: number; visitors: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(todayMs - i * 86_400_000).toISOString().slice(0, 10);
      const r = dayMap.get(day);
      rows.push({ day, n: r?.n ?? 0, visitors: r?.visitors ?? 0 });
    }
    return rows;
  }, [stats.byDay, todayMs]);

  // heatmap
  const heat = new Map<string, number>();
  let heatMax = 1;
  for (const h of stats.heatmap) {
    heat.set(`${h.dow}|${h.hour}`, h.n);
    if (h.n > heatMax) heatMax = h.n;
  }
  let peak: { dow: number; hour: number } | null = null;
  let peakN = -1;
  for (const h of stats.heatmap) if (h.n > peakN) { peakN = h.n; peak = h; }

  const clubs = new Map((site?.clubs ?? []).map((c) => [c.slug, c.name]));
  const total30 = stats.sections.reduce((a, s) => a + s.n, 0);
  const refTotal = stats.referrers.direct + stats.referrers.internal + stats.referrers.external.reduce((a, r) => a + r.n, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="วิววันนี้" value={t?.viewsToday ?? 0} />
        <Kpi label="ผู้เข้าชมวันนี้" value={t?.visitorsToday ?? '—'} />
        <Kpi
          label="วิว 7 วัน"
          value={t?.views7d ?? 0}
          sub={
            wow != null ? (
              <span className={wow >= 0 ? 'text-success' : 'text-danger'}>
                {signed(wow * 100, 2)}% vs สัปดาห์ก่อน
              </span>
            ) : (
              <span className="text-muted">—</span>
            )
          }
        />
        <Kpi
          label="ผู้เข้าชมเฉลี่ย/วัน (7 วัน)"
          value={t ? fmt(t.visitorDays7d / 7) : '—'}
        />
        <Kpi label="วิว 30 วัน" value={t?.views30d ?? 0} />
        <Kpi label="ทั้งหมด" value={t?.views ?? 0} />
      </div>

      <Card title="วิวและผู้เข้าชม — 30 วัน (เวลาไทย)">
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-light)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(d: string) => d.slice(8)}
                interval={2}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="n" name="วิว" fill="var(--brand)" isAnimationActive={false} />
              <Line
                dataKey="visitors"
                name="ผู้เข้าชม"
                stroke="var(--text-secondary)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="ช่วงเวลาที่เข้าชม — 30 วัน (เวลาไทย)">
        <div className="overflow-x-auto">
          <div className="flex min-w-[720px] flex-col gap-0.5">
            <div className="flex gap-0.5 pl-8">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="flex-1 text-center text-[9px] tabular-nums text-muted">
                  {h % 3 === 0 ? h : ''}
                </span>
              ))}
            </div>
            {DOW_TH.map((lbl, dow) => (
              <div key={dow} className="flex items-center gap-0.5">
                <span className="w-8 text-right text-xs text-muted">{lbl}</span>
                {Array.from({ length: 24 }, (_, h) => {
                  const n = heat.get(`${dow}|${h}`) ?? 0;
                  const p = Math.round((n / heatMax) * 85) + 5;
                  return (
                    <span
                      key={h}
                      title={`${DOW_FULL[dow]} ${h}:00 — ${n} วิว`}
                      className="h-4 flex-1 rounded-sm"
                      style={{
                        background: n
                          ? `color-mix(in srgb, var(--brand) ${p}%, var(--surface))`
                          : 'var(--bg-secondary)',
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {peak && (
          <p className="mt-2 text-xs text-muted">
            ช่วงที่คนเข้ามากสุด: {DOW_FULL[peak.dow]} {String(peak.hour).padStart(2, '0')}:00
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ส่วนของเว็บ — 30 วัน">
          <BarList
            rows={stats.sections.map((s) => ({
              k: s.section,
              n: s.n,
              sub: total30 ? pct(s.n / total30, 2) : undefined,
            }))}
            label={(k) => SECTION_TH[k] ?? k}
          />
        </Card>
        <Card title="ที่มา — 30 วัน">
          <BarList
            rows={[
              { k: 'direct', n: stats.referrers.direct },
              { k: 'internal', n: stats.referrers.internal },
              ...stats.referrers.external.map((r) => ({ k: r.host, n: r.n })),
            ].map((r) => ({ ...r, sub: refTotal ? pct(r.n / refTotal, 2) : undefined }))}
            label={(k) => (k === 'direct' ? 'เข้าตรง' : k === 'internal' ? 'ภายในเว็บ' : k)}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="หน้ายอดนิยม">
          <table className="w-full">
            <tbody>
              {stats.topPaths.slice(0, 15).map((p) => (
                <tr key={p.path} className="border-b border-border-light last:border-0">
                  <td className="py-1.5 pr-3 text-sm text-secondary">{p.path}</td>
                  <td className="py-1.5 text-right text-sm tabular-nums text-primary">{p.n}</td>
                </tr>
              ))}
              {stats.topPaths.length === 0 && (
                <tr><td className="py-3 text-sm text-muted">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card title="สโมสรยอดนิยม">
          <table className="w-full">
            <tbody>
              {stats.topClubs.map((c) => (
                <tr key={c.club} className="border-b border-border-light last:border-0">
                  <td className="py-1.5 pr-3 text-sm text-secondary">
                    {clubs.get(c.club) ?? c.club}
                  </td>
                  <td className="py-1.5 text-right text-sm tabular-nums text-primary">{c.n}</td>
                </tr>
              ))}
              {stats.topClubs.length === 0 && (
                <tr><td className="py-3 text-sm text-muted">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="กิจกรรมล่าสุด">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <tbody>
              {stats.recent.map((r, i) => (
                <tr key={i} className="border-b border-border-light last:border-0">
                  <td className="py-1.5 pr-3 text-sm tabular-nums text-muted whitespace-nowrap">
                    {thaiTime(r.created_at)}
                  </td>
                  <td className="py-1.5 pr-3 text-sm text-secondary">{r.path}</td>
                  <td className="py-1.5 pr-3 text-sm text-muted">{r.device ?? '—'}</td>
                  <td className="py-1.5 pr-3 text-sm text-muted">{r.country ?? '—'}</td>
                  <td className="py-1.5 text-sm text-muted">{r.lang ?? '—'}</td>
                </tr>
              ))}
              {stats.recent.length === 0 && (
                <tr><td className="py-3 text-sm text-muted">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          ไม่รวมบอท ({t?.bots30d ?? 0} วิว ใน 30 วัน)
          {t?.trackedSince ? ` · เริ่มเก็บข้อมูลผู้เข้าชมตั้งแต่ ${thaiTime(t.trackedSince, false)}` : ''}
        </p>
      </Card>
    </>
  );
}

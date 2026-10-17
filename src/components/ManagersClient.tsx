'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '@/i18n/I18nContext';
import type { MatchRow } from '@/lib/types';
import {
  MANAGERS,
  aggregateManagers,
  ptsOf,
  perMp,
  winPct,
  csPct,
  type ManagerStats,
} from '@/lib/managers';
import { fmt, pct } from '@/lib/format';

export function ManagersClient({ matches }: { matches: MatchRow[] }) {
  const { t, lang } = useI18n();
  const stats = useMemo(() => aggregateManagers(matches), [matches]);
  const [selected, setSelected] = useState<string[]>(['ferguson', 'mourinho', 'ten-hag']);
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const chosen = MANAGERS.filter((m) => selected.includes(m.id));
  const name = (id: string) => {
    const m = MANAGERS.find((x) => x.id === id)!;
    return lang === 'th' ? m.nameTh : m.name;
  };

  const chartData = chosen.map((m) => {
    const s = stats.get(m.id)!.total;
    return {
      name: name(m.id),
      [t('managers.ptsPerMp')]: perMp(ptsOf(s), s.mp) ?? 0,
      [t('managers.winPct')]: (winPct(s) ?? 0) * 100,
    };
  });

  const row = (s: ManagerStats, indent = false) => (
    <>
      <td className="px-3 py-2.5 text-right text-sm text-secondary">{s.mp}</td>
      <td className="px-3 py-2.5 text-right text-sm text-secondary">
        {s.w}–{s.d}–{s.l}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-secondary">
        {fmt(perMp(ptsOf(s), s.mp), 2)}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-secondary">
        {pct(winPct(s), 2)}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-secondary">
        {fmt(perMp(s.gf, s.mp))} / {fmt(perMp(s.ga, s.mp))}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-secondary">
        {pct(csPct(s), 2)}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-secondary">
        {s.xg != null ? fmt(perMp(s.xg, s.mp)) : '—'}
      </td>
      <td className="px-3 py-2.5 text-right text-sm text-secondary">
        {s.xga != null ? fmt(perMp(s.xga, s.mp)) : '—'}
      </td>
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-primary">
          {t('managers.pick')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {MANAGERS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                selected.includes(m.id)
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-border bg-surface text-secondary hover:bg-bg-secondary'
              }`}
              aria-pressed={selected.includes(m.id)}
            >
              {name(m.id)}
              {m.interim && (
                <span className="ml-1 text-xs text-muted">
                  ({t('managers.interim')})
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {chosen.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
          <h3 className="mb-2 font-display text-lg font-semibold text-primary">
            {t('managers.chartTitle')}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis
                  yAxisId="pts"
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  domain={[0, 3]}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Legend />
                <Bar
                  yAxisId="pts"
                  dataKey={t('managers.ptsPerMp')}
                  fill="var(--brand)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="pct"
                  dataKey={t('managers.winPct')}
                  fill="var(--chart-neutral)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:shadow-none">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-primary">
            {t('managers.tableTitle')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="bg-surface-elevated">
              <tr>
                {[
                  t('managers.colManager'),
                  t('managers.colPeriod'),
                  t('table.mp'),
                  'W–D–L',
                  t('table.ptsPerMp'),
                  t('table.winRate'),
                  'GF/GA ' + t('managers.perMp'),
                  t('table.csRate'),
                  'xG/' + t('managers.perMp'),
                  'xGA/' + t('managers.perMp'),
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`border-b border-border px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted ${
                      i < 2 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chosen.map((m) => {
                const agg = stats.get(m.id)!;
                const s = agg.total;
                const isOpen = expanded === m.id;
                return [
                  <tr
                    key={m.id}
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    className="cursor-pointer border-b border-border transition-colors hover:bg-bg-secondary"
                  >
                    <td className="px-3 py-2.5 text-sm font-medium text-primary">
                      <span className="flex items-center gap-1.5">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {name(m.id)}
                        {m.interim && (
                          <span className="text-xs text-muted">
                            ({t('managers.interim')})
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted">
                      {s.mp > 0 ? `${s.first} → ${s.last}` : '—'}
                    </td>
                    {row(s)}
                  </tr>,
                  ...(isOpen
                    ? agg.seasons.map((ss) => (
                        <tr
                          key={`${m.id}-${ss.season}`}
                          className="border-b border-border-light bg-bg-secondary/50"
                        >
                          <td className="px-3 py-2 pl-9 text-sm text-muted">
                            {ss.season}
                          </td>
                          <td className="px-3 py-2 text-sm text-muted">
                            {ss.first} → {ss.last}
                          </td>
                          {row(ss, true)}
                        </tr>
                      ))
                    : []),
                ];
              })}
              {chosen.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted">
                    {t('managers.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

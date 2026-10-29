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

import {
  aggregateManagers,
  managerForDate,
  stintId,
  ptsOf,
  perMp,
  winPct,
  csPct,
  type ManagerStats,
} from '@/lib/managers';
import type { CompGroup, MatchRow } from '@/lib/types';
import { compInGroup } from '@/lib/stats';
import { fmt, pct } from '@/lib/format';
import { useClubData } from './ClubProvider';
import { ScoresList } from './matchlog-shared';

export function ManagersClient({ group }: { group: CompGroup }) {
  const { t, lang } = useI18n();
  const { matches, stints } = useClubData();
  const stats = useMemo(
    () =>
      aggregateManagers(
        stints,
        matches.filter((m) => compInGroup(m.competition, group)),
      ),
    [stints, matches, group],
  );
  const stintMatches = useMemo(() => {
    const map = new Map<string, MatchRow[]>();
    for (const m of matches) {
      if (!compInGroup(m.competition, group)) continue;
      const stint = managerForDate(stints, m.date);
      if (!stint) continue;
      const id = stintId(stint);
      const arr = map.get(id);
      if (arr) arr.push(m);
      else map.set(id, [m]);
    }
    return map;
  }, [stints, matches, group]);
  const showComp = group === 'all' || group === 'europe';
  const [selected, setSelected] = useState<string[]>(() =>
    stints.filter((m) => !m.interim).slice(-3).map(stintId)
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const chosen = stints.filter((m) => selected.includes(stintId(m)));
  const name = (id: string) => {
    const m = stints.find((x) => stintId(x) === id)!;
    const base = lang === 'th' && m.nameTh ? m.nameTh : m.name;
    return m.coName ? `${base} & ${m.coName}` : base;
  };

  const chartData = chosen.map((m) => {
    const s = stats.get(stintId(m))!.total;
    return {
      name: name(stintId(m)),
      [t('managers.ptsPerMp')]: perMp(ptsOf(s), s.mp) ?? 0,
      [t('managers.winPct')]: (winPct(s) ?? 0) * 100,
    };
  });

  const row = (s: ManagerStats) => (
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-primary">
          {t('managers.pick')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {stints.map((m) => (
            <button
              key={stintId(m)}
              type="button"
              onClick={() => toggle(stintId(m))}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
                selected.includes(stintId(m))
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-border bg-surface text-secondary hover:bg-bg-secondary'
              }`}
              aria-pressed={selected.includes(stintId(m))}
            >
              {name(stintId(m))}
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
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="pct"
                  dataKey={t('managers.winPct')}
                  fill="var(--chart-neutral)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
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
                const mid = stintId(m);
                const agg = stats.get(mid)!;
                const s = agg.total;
                const isOpen = expanded === mid;
                return [
                  <tr
                    key={mid}
                    onClick={() => setExpanded(isOpen ? null : mid)}
                    className="cursor-pointer border-b border-border transition-colors hover:bg-bg-secondary"
                  >
                    <td className="px-3 py-2.5 text-sm font-medium text-primary">
                      <span className="flex items-center gap-1.5">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {name(mid)}
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
                    ? [
                        ...agg.seasons.map((ss) => (
                          <tr
                            key={`${mid}-${ss.season}`}
                            className="border-b border-border-light bg-bg-secondary/50"
                          >
                            <td className="px-3 py-2 pl-9 text-sm text-muted">
                              {ss.season}
                            </td>
                            <td className="px-3 py-2 text-sm text-muted">
                              {ss.first} → {ss.last}
                            </td>
                            {row(ss)}
                          </tr>
                        )),
                        <tr
                          key={`${mid}-log`}
                          className="border-b border-border"
                        >
                          <td colSpan={10} className="px-4 py-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                              {t('managers.matchLog')} ·{' '}
                              {(stintMatches.get(mid) ?? []).length}{' '}
                              {t('matchLog.matches')}
                            </div>
                            {(stintMatches.get(mid) ?? []).length > 0 ? (
                              <ScoresList
                                rows={stintMatches.get(mid)!}
                                showComp={showComp}
                              />
                            ) : (
                              <p className="py-4 text-sm text-muted">
                                {t('matchLog.noData')}
                              </p>
                            )}
                          </td>
                        </tr>,
                      ]
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
    </div>
  );
}

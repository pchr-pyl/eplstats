'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { SeasonRow, MatchRow, CompGroup } from '@/lib/types';
import { winRate, csRate, avg, matchesForSeason } from '@/lib/stats';
import { fmt, signed, pct } from '@/lib/format';

interface Kpi {
  key: string;
  label: string;
  value: (r: SeasonRow) => number | null;
  format: (n: number | null) => string;
  deltaFormat: (n: number) => string;
  invert?: boolean;
}

export function KpiCards({ rows, matches, group }: { rows: SeasonRow[]; matches: MatchRow[]; group: CompGroup }) {
  const { t } = useI18n();

  const sorted = [...rows].sort((a, b) => a.season.localeCompare(b.season));
  const latest = sorted[sorted.length - 1] ?? null;
  const previous = sorted[sorted.length - 2] ?? null;

  const perMatch = (num: number | null, den: number | null) => {
    if (num == null || den == null || den === 0) return null;
    return num / den;
  };

  const played = (season: string) => matchesForSeason(matches, season, group)
    .filter((m) => m.gf != null && m.ga != null && ['W', 'D', 'L'].includes(m.result ?? ''));
  const failedToScore = (r: SeasonRow) => {
    const games = played(r.season);
    return games.length ? games.filter((m) => m.gf === 0).length / games.length : null;
  };
  const form = latest ? played(latest.season).slice(-5) : [];
  const formPoints = form.reduce((sum, m) => sum + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0), 0);

  const kpis: Kpi[] = [
    {
      key: 'ptsPerMp',
      label: t('kpi.ptsPerMp'),
      value: (r) => r.ptsPerMp,
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
    },
    {
      key: 'gfPerMp',
      label: t('kpi.gfPerMp'),
      value: (r) => perMatch(r.gf, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
    },
    {
      key: 'gaPerMp',
      label: t('kpi.gaPerMp'),
      value: (r) => perMatch(r.ga, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
      invert: true,
    },
    {
      key: 'winRate',
      label: t('kpi.winRate'),
      value: winRate,
      format: (n) => pct(n, 2),
      deltaFormat: (n) => `${signed(n * 100, 2)} ${t('kpi.pp')}`,
    },
    {
      key: 'csRate',
      label: t('kpi.csRate'),
      value: csRate,
      format: (n) => pct(n, 2),
      deltaFormat: (n) => `${signed(n * 100, 2)} ${t('kpi.pp')}`,
    },
  ];

  const extraKpis: Kpi[] = [];

  if (latest?.xg != null) {
    extraKpis.push({
      key: 'xgPerMp',
      label: t('kpi.xgPerMp'),
      value: (r) => perMatch(r.xg, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
    });
  }

  if (latest?.xga != null) {
    extraKpis.push({
      key: 'xgaPerMp',
      label: t('kpi.xgaPerMp'),
      value: (r) => perMatch(r.xga, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
      invert: true,
    });
  }

  if (latest?.sota != null) {
    extraKpis.push({
      key: 'sotaPerMp',
      label: t('kpi.sotaPerMp'),
      value: (r) => perMatch(r.sota, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
      invert: true,
    });
  }

  kpis.push({
    key: 'gdPerMp', label: t('kpi.gdPerMp'),
    value: (r) => perMatch(r.gf != null && r.ga != null ? r.gf - r.ga : null, r.mp),
    format: (n) => signed(n, 2), deltaFormat: (n) => signed(n, 2),
  }, {
    key: 'failedToScore', label: t('kpi.failedToScore'), value: failedToScore,
    format: (n) => pct(n, 2), deltaFormat: (n) => `${signed(n * 100, 2)} ${t('kpi.pp')}`, invert: true,
  });
  const order = ['ptsPerMp', 'winRate', 'gfPerMp', 'gaPerMp', 'gdPerMp', 'csRate', 'failedToScore'];
  kpis.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const renderKpi = (kpi: Kpi) => {
        const current = latest ? kpi.value(latest) : null;
        const prev = previous ? kpi.value(previous) : null;
        const mean = avg(rows, kpi.value);

        let diff: number | null = null;
        if (current != null && prev != null) {
          diff = current - prev;
        }

        const isInverted = kpi.invert ?? false;
        let deltaColor = 'text-muted';
        if (diff != null) {
          const good = isInverted ? diff < 0 : diff > 0;
          const bad = isInverted ? diff > 0 : diff < 0;
          if (good) deltaColor = 'text-success';
          if (bad) deltaColor = 'text-danger';
        }

        return (
          <div
            key={kpi.key}
            className="min-w-0 flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
          >
            <span className="text-xs font-medium text-muted">{kpi.label}</span>
            <span className="mt-2 font-body text-3xl font-bold text-primary">
              {kpi.format(current)}
            </span>

            {diff != null ? (
              <span className={`mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm font-semibold ${deltaColor}`}>
                {diff > 0 ? <ArrowUp size={14} /> : diff < 0 ? <ArrowDown size={14} /> : <Minus size={14} />}
                {kpi.deltaFormat(diff)}
                <span className="w-full text-xs font-normal text-muted">
                  {t('kpi.vsPrevious')}
                </span>
              </span>
            ) : (
              <span className="mt-2 flex items-center gap-1 text-sm text-muted">
                <Minus size={14} />
                {t('kpi.vsPrevious')}
              </span>
            )}

            {mean != null ? (
              <span className="mt-3 text-xs text-muted">
                {t('kpi.avg')} {kpi.format(mean)}
              </span>
            ) : (
              <span className="mt-3 text-xs text-muted">—</span>
            )}
          </div>
        );
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        {t('kpi.latestSeason')}: {latest?.season ?? '—'} · {t('kpi.averageRange')}: {sorted[0]?.season ?? '—'} – {latest?.season ?? '—'}
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {kpis.slice(0, 2).map(renderKpi)}
        <div className="min-w-0 flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none">
          <span className="text-xs font-medium text-muted">{t('kpi.last5')}</span>
          <span className="mt-2 text-3xl font-bold text-primary">{form.length ? `${formPoints}/${form.length * 3}` : '—'}</span>
          <span className="mt-1 text-xs text-muted">{t('kpi.points')}</span>
          <div className="mt-3 flex flex-wrap gap-1" aria-label={t('kpi.oldestFirst')}>
            {form.map((m, i) => (
              <span key={`${m.date}-${i}`} title={`${m.date} · ${m.opponent ?? '—'} · ${m.gf}–${m.ga} (${m.result})`}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${m.result === 'W' ? 'bg-success/15 text-success' : m.result === 'L' ? 'bg-danger/15 text-danger' : 'bg-muted/15 text-muted'}`}>
                {m.result}
              </span>
            ))}
          </div>
          <span className="mt-3 text-xs text-muted">{t('kpi.oldestFirst')}</span>
        </div>
        {kpis.slice(2).map(renderKpi)}
      </div>
      {extraKpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{extraKpis.map(renderKpi)}</div>
      )}
    </div>
  );
}

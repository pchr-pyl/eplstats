'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import type { SeasonRow } from '@/lib/types';
import { winRate, csRate, avg } from '@/lib/stats';
import { fmt, signed, pct } from '@/lib/format';

interface Kpi {
  key: string;
  label: string;
  value: (r: SeasonRow) => number | null;
  format: (n: number | null) => string;
  deltaFormat: (n: number) => string;
  invert?: boolean;
}

export function KpiCards({ rows }: { rows: SeasonRow[] }) {
  const { t } = useI18n();

  const sorted = [...rows].sort((a, b) => a.season.localeCompare(b.season));
  const latest = sorted[sorted.length - 1] ?? null;
  const previous = sorted[sorted.length - 2] ?? null;

  const perMatch = (num: number | null, den: number | null) => {
    if (num == null || den == null || den === 0) return null;
    return num / den;
  };

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
      format: pct,
      deltaFormat: (n) => pct(n, 2),
    },
    {
      key: 'csRate',
      label: t('kpi.csRate'),
      value: csRate,
      format: pct,
      deltaFormat: (n) => pct(n, 2),
    },
  ];

  if (latest?.xg != null) {
    kpis.push({
      key: 'xgPerMp',
      label: t('kpi.xgPerMp'),
      value: (r) => perMatch(r.xg, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
    });
  }

  if (latest?.xga != null) {
    kpis.push({
      key: 'xgaPerMp',
      label: t('kpi.xgaPerMp'),
      value: (r) => perMatch(r.xga, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
      invert: true,
    });
  }

  if (latest?.sota != null) {
    kpis.push({
      key: 'sotaPerMp',
      label: t('kpi.sotaPerMp'),
      value: (r) => perMatch(r.sota, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
      invert: true,
    });
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
      {kpis.map((kpi) => {
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
            className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
          >
            <span className="text-xs font-medium text-muted">{kpi.label}</span>
            <span className="mt-2 font-body text-3xl font-bold text-primary">
              {kpi.format(current)}
            </span>

            {diff != null ? (
              <span className={`mt-2 flex items-center gap-1 text-sm font-semibold ${deltaColor}`}>
                {diff > 0 ? <ArrowUp size={14} /> : diff < 0 ? <ArrowDown size={14} /> : <Minus size={14} />}
                {kpi.deltaFormat(diff)}
                <span className="ml-1 text-xs font-normal text-muted">
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
      })}
    </div>
  );
}

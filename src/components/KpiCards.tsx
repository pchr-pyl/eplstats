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
  subContext?: (r: SeasonRow) => { text: string; tone?: 'pos' | 'neg' | 'neutral' } | null;
  semanticValue?: boolean;
  invert?: boolean;
}

export function KpiCards({
  rows,
  matches,
  group,
}: {
  rows: SeasonRow[];
  matches: MatchRow[];
  group: CompGroup;
}) {
  const { t, lang } = useI18n();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);

  const sorted = [...rows].sort((a, b) => a.season.localeCompare(b.season));
  const latest = sorted[sorted.length - 1] ?? null;
  const previous = sorted[sorted.length - 2] ?? null;

  const perMatch = (num: number | null, den: number | null) => {
    if (num == null || den == null || den === 0) return null;
    return num / den;
  };

  const played = (season: string) =>
    matchesForSeason(matches, season, group).filter(
      (m) => m.gf != null && m.ga != null && ['W', 'D', 'L'].includes(m.result ?? ''),
    );

  const failedToScore = (r: SeasonRow) => {
    const games = played(r.season);
    return games.length ? games.filter((m) => m.gf === 0).length / games.length : null;
  };

  const form = latest ? played(latest.season).slice(-5) : [];
  const formPoints = form.reduce(
    (sum, m) => sum + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0),
    0,
  );
  const formW = form.filter((m) => m.result === 'W').length;
  const formD = form.filter((m) => m.result === 'D').length;
  const formL = form.filter((m) => m.result === 'L').length;

  const kpis: Kpi[] = [
    {
      key: 'ptsPerMp',
      label: t('kpi.ptsPerMp'),
      value: (r) => r.ptsPerMp,
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
      subContext: (r) =>
        r.pts != null && r.mp != null
          ? { text: `${fmt(r.pts, 0)} ${t('table.pts')} / ${fmt(r.mp, 0)} ${t('table.mp')}` }
          : null,
    },
    {
      key: 'winRate',
      label: t('kpi.winRate'),
      value: winRate,
      format: (n) => pct(n, 2),
      deltaFormat: (n) => `${signed(n * 100, 2)} ${t('kpi.pp')}`,
      subContext: (r) =>
        r.w != null && r.mp != null
          ? { text: `${fmt(r.w, 0)}W – ${fmt(r.d, 0)}D – ${fmt(r.l, 0)}L` }
          : null,
    },
    {
      key: 'gfPerMp',
      label: t('kpi.gfPerMp'),
      value: (r) => perMatch(r.gf, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
      subContext: (r) =>
        r.gf != null ? { text: `${fmt(r.gf, 0)} ${tx('total goals', 'ประตูรวม')}` } : null,
    },
    {
      key: 'gaPerMp',
      label: t('kpi.gaPerMp'),
      value: (r) => perMatch(r.ga, r.mp),
      format: (n) => fmt(n, 2),
      deltaFormat: (n) => signed(n, 2),
      invert: true,
      subContext: (r) =>
        r.ga != null ? { text: `${fmt(r.ga, 0)} ${tx('conceded', 'เสียประตูรวม')}` } : null,
    },
    {
      key: 'gdPerMp',
      label: t('kpi.gdPerMp'),
      value: (r) => perMatch(r.gf != null && r.ga != null ? r.gf - r.ga : null, r.mp),
      format: (n) => signed(n, 2),
      deltaFormat: (n) => signed(n, 2),
      semanticValue: true,
      subContext: (r) =>
        r.gd != null
          ? {
              text: `${signed(r.gd, 0)} ${tx('season GD', 'ผลต่างทั้งฤดูกาล')}`,
              tone: r.gd > 0 ? 'pos' : r.gd < 0 ? 'neg' : 'neutral',
            }
          : null,
    },
    {
      key: 'csRate',
      label: t('kpi.csRate'),
      value: csRate,
      format: (n) => pct(n, 2),
      deltaFormat: (n) => `${signed(n * 100, 2)} ${t('kpi.pp')}`,
      subContext: (r) =>
        r.cs != null && r.mp != null
          ? { text: `${fmt(r.cs, 0)} / ${fmt(r.mp, 0)} ${tx('shutouts', 'คลีนชีต')}` }
          : null,
    },
    {
      key: 'failedToScore',
      label: t('kpi.failedToScore'),
      value: failedToScore,
      format: (n) => pct(n, 2),
      deltaFormat: (n) => `${signed(n * 100, 2)} ${t('kpi.pp')}`,
      invert: true,
      subContext: (r) => {
        const games = played(r.season);
        if (!games.length) return null;
        const blanks = games.filter((m) => m.gf === 0).length;
        return { text: `${blanks} / ${games.length} ${tx('goalless', 'ยิงไม่ได้')}` };
      },
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
      subContext: (r) => {
        if (r.gf == null || r.xg == null) return null;
        const over = r.gf - r.xg;
        return {
          text: `${tx('G − xG', 'ประตู − xG')}: ${signed(over, 2)}`,
          tone: over > 0 ? 'pos' : over < 0 ? 'neg' : 'neutral',
        };
      },
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
      subContext: (r) => {
        if (r.ga == null || r.xga == null) return null;
        const diff = r.ga - r.xga;
        return {
          text: `${tx('GA − xGA', 'เสีย − xGA')}: ${signed(diff, 2)}`,
          tone: diff < 0 ? 'pos' : diff > 0 ? 'neg' : 'neutral',
        };
      },
    });
  }

  if (latest?.xgd != null) {
    extraKpis.push({
      key: 'xgdPerMp',
      label: tx('xGD / MP', 'xGD / นัด'),
      value: (r) => perMatch(r.xgd, r.mp),
      format: (n) => signed(n, 2),
      deltaFormat: (n) => signed(n, 2),
      semanticValue: true,
      subContext: (r) =>
        r.xgd != null
          ? {
              text: `${signed(r.xgd, 2)} ${tx('season xGD', 'xGD ทั้งฤดูกาล')}`,
              tone: r.xgd > 0 ? 'pos' : r.xgd < 0 ? 'neg' : 'neutral',
            }
          : null,
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
      subContext: (r) =>
        r.sota != null ? { text: `${fmt(r.sota, 0)} ${tx('total SoTA', 'ตรงกรอบรวม')}` } : null,
    });
  }

  const renderKpi = (kpi: Kpi) => {
    const current = latest ? kpi.value(latest) : null;
    const prev = previous ? kpi.value(previous) : null;
    const mean = avg(rows, kpi.value);

    const diff = current != null && prev != null ? current - prev : null;
    const isInverted = kpi.invert ?? false;

    let deltaBadge = 'bg-bg-secondary text-muted';
    if (diff != null && Math.abs(diff) > 1e-9) {
      const good = isInverted ? diff < 0 : diff > 0;
      deltaBadge = good
        ? 'bg-success-soft text-success'
        : 'bg-danger-soft text-danger';
    }

    let valueColor = 'text-primary';
    if (kpi.semanticValue && current != null) {
      if (current > 0) valueColor = 'text-success';
      else if (current < 0) valueColor = 'text-danger';
    }

    const ctx = latest && kpi.subContext ? kpi.subContext(latest) : null;
    const ctxTone =
      ctx?.tone === 'pos'
        ? 'text-success'
        : ctx?.tone === 'neg'
          ? 'text-danger'
          : 'text-secondary';

    return (
      <div
        key={kpi.key}
        className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand/35 dark:shadow-none"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2.5px] bg-brand/60 transition-opacity group-hover:bg-brand"
        />

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
              {kpi.label}
            </span>
          </div>

          <div
            className={`mt-2 font-display text-2xl font-extrabold tabular-nums tracking-tight sm:text-3xl ${valueColor}`}
          >
            {kpi.format(current)}
          </div>

          {ctx && (
            <div className={`mt-1 truncate text-xs font-medium tabular-nums ${ctxTone}`}>
              {ctx.text}
            </div>
          )}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-border-light pt-2.5">
          {diff != null ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${deltaBadge}`}
              title={`${kpi.deltaFormat(diff)} ${t('kpi.vsPrevious')}`}
            >
              {diff > 0 ? (
                <ArrowUp size={11} />
              ) : diff < 0 ? (
                <ArrowDown size={11} />
              ) : (
                <Minus size={11} />
              )}
              {kpi.deltaFormat(diff)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted">
              <Minus size={11} />
              {tx('prev', 'ก่อนหน้า')}
            </span>
          )}

          <span className="text-[11px] font-medium tabular-nums text-muted">
            {mean != null ? `${t('kpi.avg')} ${kpi.format(mean)}` : '—'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tabular-nums text-muted">
          <span className="font-bold text-secondary">{t('kpi.latestSeason')}:</span>{' '}
          {latest?.season ?? '—'} ·{' '}
          <span className="font-bold text-secondary">{t('kpi.averageRange')}:</span>{' '}
          {sorted[0]?.season ?? '—'} – {latest?.season ?? '—'}
        </p>
        <span className="text-[11px] text-muted">
          {tx('Badge = delta vs previous season', 'ป้ายสี = เทียบกับฤดูกาลก่อนหน้า')}
        </span>
      </div>

      {/* Primary 8 editorial tiles (2 cols mobile, 4 cols desktop) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.slice(0, 2).map(renderKpi)}

        {/* Last 5 matches form tile */}
        <div className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand/35 dark:shadow-none">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2.5px] bg-brand/60 transition-opacity group-hover:bg-brand"
          />
          <div>
            <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">
              {t('kpi.last5')}
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-extrabold tabular-nums tracking-tight text-primary sm:text-3xl">
                {form.length ? `${formPoints}/${form.length * 3}` : '—'}
              </span>
              {form.length > 0 && (
                <span className="text-xs font-medium text-muted">{t('kpi.points')}</span>
              )}
            </div>
            {form.length > 0 && (
              <div className="mt-1 text-xs font-medium tabular-nums text-secondary">
                {formW}W – {formD}D – {formL}L
              </div>
            )}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-border-light pt-2.5">
            <div className="flex flex-wrap gap-1" aria-label={t('kpi.oldestFirst')}>
              {form.map((m, i) => (
                <span
                  key={`${m.date}-${i}`}
                  title={`${m.date} · ${m.opponent ?? '—'} · ${m.gf}–${m.ga} (${m.result})`}
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-extrabold ${
                    m.result === 'W'
                      ? 'bg-success-soft text-success'
                      : m.result === 'L'
                        ? 'bg-danger-soft text-danger'
                        : 'bg-bg-secondary text-muted'
                  }`}
                >
                  {m.result}
                </span>
              ))}
            </div>
            <span className="text-[10px] text-muted">{t('kpi.oldestFirst')}</span>
          </div>
        </div>

        {kpis.slice(2).map(renderKpi)}
      </div>

      {/* Underlying xG & shots metrics row */}
      {extraKpis.length > 0 && (
        <div
          className={`grid grid-cols-2 gap-3 ${
            extraKpis.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
          }`}
        >
          {extraKpis.map(renderKpi)}
        </div>
      )}
    </div>
  );
}

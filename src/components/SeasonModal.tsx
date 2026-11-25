'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import type { MatchRow, CompGroup } from '@/lib/types';
import { matchesForSeason } from '@/lib/stats';
import { fmt, signed, pct } from '@/lib/format';
import { useI18n } from '@/i18n/I18nContext';
import { useClub } from './ClubProvider';
import { ClubCrest } from './LeagueHome';
import { MatchLog } from './MatchLog';

export function SeasonModal({
  season,
  group,
  matches,
  onClose,
}: {
  season: string;
  group: CompGroup;
  matches: MatchRow[];
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const { club } = useClub();
  const th = lang === 'th';
  const tx = (en: string, thText: string) => (th ? thText : en);
  const clubName = th && club.nameTh ? club.nameTh : club.name;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const summary = useMemo(() => {
    const list = matchesForSeason(matches, season, group).filter(
      (m) => m.gf != null && m.ga != null && ['W', 'D', 'L'].includes(m.result ?? ''),
    );
    const mp = list.length;
    let w = 0;
    let d = 0;
    let l = 0;
    let gf = 0;
    let ga = 0;
    let cs = 0;
    let xg = 0;
    let xga = 0;
    let xgN = 0;
    for (const m of list) {
      if (m.result === 'W') w++;
      else if (m.result === 'D') d++;
      else if (m.result === 'L') l++;
      gf += m.gf ?? 0;
      ga += m.ga ?? 0;
      if (m.ga === 0) cs++;
      if (m.xg != null && m.xga != null) {
        xg += m.xg;
        xga += m.xga;
        xgN++;
      }
    }
    const pts = w * 3 + d;
    return {
      mp,
      w,
      d,
      l,
      gf,
      ga,
      gd: gf - ga,
      pts,
      ppg: mp > 0 ? pts / mp : null,
      winPct: mp > 0 ? w / mp : null,
      cs,
      csPct: mp > 0 ? cs / mp : null,
      xg: xgN > 0 ? xg : null,
      xga: xgN > 0 ? xga : null,
      xgd: xgN > 0 ? xg - xga : null,
    };
  }, [matches, season, group]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`${clubName} ${season}`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <span aria-hidden className="h-[3px] w-full shrink-0 bg-brand" />

        {/* Editorial Modal Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-elevated px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface p-1.5">
              <ClubCrest slug={club.slug} size={28} alt={clubName} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <span>{tx('Season Breakdown', 'สรุปผลงานประจำฤดูกาล')}</span>
                <span className="text-border">•</span>
                <span className="rounded bg-brand-soft px-1.5 py-0.5 text-brand">
                  {t(`competitions.${group}`)}
                </span>
              </div>
              <h3 className="mt-0.5 truncate font-display text-lg font-bold text-primary sm:text-xl">
                {clubName} · <span className="tabular-nums">{season}</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${club.slug}/season/`}
              onClick={onClose}
              className="hidden items-center gap-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand sm:inline-flex"
            >
              <span>{t('nav.season')}</span>
              <ArrowRight size={12} />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={t('matchLog.close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Crisp Metric Grid */}
        {summary.mp > 0 && (
          <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-border bg-bg-secondary/50 px-4 py-3 sm:grid-cols-6 sm:px-5">
            <div className="rounded-xl border border-border-light bg-surface px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {tx('Record', 'สถิติ')}
              </div>
              <div className="mt-0.5 font-display text-sm font-extrabold tabular-nums text-primary">
                {summary.w}-{summary.d}-{summary.l}
              </div>
              <div className="text-[10px] tabular-nums text-muted">
                {pct(summary.winPct, 2)}
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {t('table.pts')}
              </div>
              <div className="mt-0.5 font-display text-sm font-extrabold tabular-nums text-primary">
                {fmt(summary.pts, 0)}
              </div>
              <div className="text-[10px] tabular-nums text-muted">
                {fmt(summary.ppg, 2)} PPG
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {tx('Goals', 'ประตู')}
              </div>
              <div className="mt-0.5 font-display text-sm font-extrabold tabular-nums text-primary">
                {summary.gf}–{summary.ga}
              </div>
              <div
                className={`text-[10px] font-bold tabular-nums ${
                  summary.gd > 0
                    ? 'text-success'
                    : summary.gd < 0
                      ? 'text-danger'
                      : 'text-muted'
                }`}
              >
                GD {signed(summary.gd, 0)}
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                xG / xGA
              </div>
              <div className="mt-0.5 font-display text-sm font-extrabold tabular-nums text-primary">
                {summary.xg != null ? `${fmt(summary.xg, 2)}` : '—'}
              </div>
              <div className="text-[10px] tabular-nums text-muted">
                {summary.xga != null ? `vs ${fmt(summary.xga, 2)}` : '—'}
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                xGD
              </div>
              <div
                className={`mt-0.5 font-display text-sm font-extrabold tabular-nums ${
                  summary.xgd != null && summary.xgd > 0
                    ? 'text-success'
                    : summary.xgd != null && summary.xgd < 0
                      ? 'text-danger'
                      : 'text-primary'
                }`}
              >
                {summary.xgd != null ? signed(summary.xgd, 2) : '—'}
              </div>
              <div className="text-[10px] text-muted">PL xG</div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface px-2.5 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {t('table.cs')}
              </div>
              <div className="mt-0.5 font-display text-sm font-extrabold tabular-nums text-primary">
                {fmt(summary.cs, 0)}
              </div>
              <div className="text-[10px] tabular-nums text-muted">
                {pct(summary.csPct, 2)}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable MatchLog body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <MatchLog
            matches={matches}
            season={season}
            group={group}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}

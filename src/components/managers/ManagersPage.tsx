'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, Clock, Flame, Swords, Table2, Trophy, UserCheck } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useClub, useClubData } from '@/components/ClubProvider';
import { ClubCrest } from '@/components/LeagueHome';
import { CompetitionTabs } from '@/components/CompetitionTabs';
import { ManagersClient } from '@/components/ManagersClient';
import { fmt, pct, signed } from '@/lib/format';
import { compInGroup } from '@/lib/stats';
import type { CompGroup } from '@/lib/types';
import {
  buildStints,
  clubPpg,
  daysInCharge,
  displayName,
  isCurrent,
  minSample,
  periodShort,
  played,
  ppg,
  rollingPpg,
  tenureDuration,
  winRate,
  type StintStat,
} from './shared';
import { VariantA } from './VariantA';
import { VariantB } from './VariantB';
import { VariantC } from './VariantC';

type Tab = 'eras' | 'leaderboard' | 'h2h' | 'classic';
const TABS: Tab[] = ['eras', 'leaderboard', 'h2h', 'classic'];

/** Restrained fade/translate entrance on mount (per tab switch). */
function Fade({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <div
      className={`mgrdemo-enter flex flex-col gap-6 motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-out ${
        on ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {children}
    </div>
  );
}

function MiniWdlBar({ s }: { s: StintStat }) {
  if (s.mp === 0) return null;
  return (
    <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary" aria-hidden>
      {s.w > 0 && (
        <span style={{ width: `${(s.w / s.mp) * 100}%`, background: 'var(--success)' }} className="h-full" />
      )}
      {s.d > 0 && (
        <span style={{ width: `${(s.d / s.mp) * 100}%`, background: 'var(--chart-neutral)' }} className="h-full" />
      )}
      {s.l > 0 && (
        <span style={{ width: `${(s.l / s.mp) * 100}%`, background: 'var(--danger)' }} className="h-full" />
      )}
    </div>
  );
}

export function ManagersPage() {
  const { lang } = useI18n();
  const L = (th: string, en: string) => (lang === 'th' ? th : en);
  const { club } = useClub();
  const { matches, stints } = useClubData();
  const [tab, setTab] = useState<Tab>('eras');
  const [group, setGroup] = useState<CompGroup>('all');

  useEffect(() => {
    let live = true;
    const read = () => {
      if (!live) return;
      const h = window.location.hash.slice(1);
      setTab(TABS.includes(h as Tab) ? (h as Tab) : 'eras');
    };
    const raf = requestAnimationFrame(read);
    window.addEventListener('hashchange', read);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('hashchange', read);
    };
  }, []);

  const setT = (v: Tab) => {
    setTab(v);
    window.history.replaceState(null, '', `#${v}`);
  };

  const games = useMemo(
    () => played(matches.filter((m) => compInGroup(m.competition, group))),
    [matches, group],
  );
  const data = useMemo(() => buildStints(stints, games), [stints, games]);
  const roll = useMemo(() => rollingPpg(games, stints), [games, stints]);
  const baseline = useMemo(() => clubPpg(games), [games]);
  const hasXg = useMemo(() => data.some((s) => s.xgN > 0), [data]);
  const minN = minSample(group);

  const clubName = lang === 'th' && club.nameTh ? club.nameTh : club.name;

  // Era Summary Highlights
  const highlights = useMemo(() => {
    const withGames = data.filter((s) => s.mp > 0);
    const qualified = withGames.filter((s) => s.mp >= minN);
    const pool = qualified.length > 0 ? qualified : withGames;

    const current =
      data.find((s) => isCurrent(s.stint) && s.mp > 0) ??
      withGames[withGames.length - 1] ??
      data[data.length - 1] ??
      null;

    const bestPpg = pool.reduce<StintStat | null>((best, s) => {
      const p = ppg(s);
      if (p == null) return best;
      if (!best) return s;
      const bp = ppg(best) ?? -1;
      return p > bp || (p === bp && s.mp > best.mp) ? s : best;
    }, null);

    const bestWin = pool.reduce<StintStat | null>((best, s) => {
      const w = winRate(s);
      if (w == null) return best;
      if (!best) return s;
      const bw = winRate(best) ?? -1;
      return w > bw || (w === bw && s.mp > best.mp) ? s : best;
    }, null);

    const longest = withGames.reduce<StintStat | null>((best, s) => {
      if (!best) return s;
      if (s.mp !== best.mp) return s.mp > best.mp ? s : best;
      return daysInCharge(s.stint) > daysInCharge(best.stint) ? s : best;
    }, null);

    return {
      current,
      bestPpg,
      bestWin,
      longest,
      usingQualified: qualified.length > 0,
      activeCount: withGames.length,
    };
  }, [data, minN]);

  const props = { data, roll, baseline, lang, hasXg, minN, group };

  const tabMeta: Record<Tab, { label: string; icon: React.ReactNode }> = {
    eras: { label: L('ยุคสมัย', 'Eras'), icon: <Clock size={14} /> },
    leaderboard: { label: L('ตารางอันดับ', 'Leaderboard'), icon: <Trophy size={14} /> },
    h2h: { label: L('ตัวต่อตัว', 'Head-to-head'), icon: <Swords size={14} /> },
    classic: { label: L('ตารางเดิม', 'Classic'), icon: <Table2 size={14} /> },
  };

  const curPpg = highlights.current ? ppg(highlights.current) : null;
  const bestPpgVal = highlights.bestPpg ? ppg(highlights.bestPpg) : null;
  const bestPpgDelta =
    bestPpgVal != null && baseline != null ? bestPpgVal - baseline : null;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10">
      {/* -------------------------------------------------- Editorial Masthead */}
      <header className="flex flex-col gap-4 border-b border-border pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface p-2 shadow-sm dark:shadow-none sm:h-14 sm:w-14">
              <ClubCrest slug={club.slug} size={40} alt={clubName} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                {L('ยุคสมัยผู้จัดการทีม · 2014–2027', 'MANAGERIAL ERAS · 2014–2027')} · {clubName}
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                {L('ผู้จัดการทีมและยุคสมัย', 'Managers & Eras')}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-secondary">
                <span>
                  <strong className="font-semibold tabular-nums text-primary">{highlights.activeCount}</strong>{' '}
                  {L('ช่วงการคุมทีม', 'managerial stints')}
                </span>
                <span className="text-muted">·</span>
                <span>
                  <strong className="font-semibold tabular-nums text-primary">{games.length}</strong>{' '}
                  {L('นัดที่ลงเล่น', 'matches played')}
                </span>
                {baseline != null && (
                  <>
                    <span className="text-muted">·</span>
                    <span>
                      {L('ค่าเฉลี่ยสโมสร', 'Club avg')}{' '}
                      <strong className="font-semibold tabular-nums text-primary">{fmt(baseline, 2)}</strong>{' '}
                      {L('แต้ม/นัด', 'PPG')}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Sleek view switcher */}
          <div
            role="group"
            aria-label={L('เลือกมุมมอง', 'Choose view')}
            className="inline-flex self-start rounded-xl border border-border bg-surface p-1 shadow-sm dark:shadow-none sm:self-end"
          >
            {TABS.map((v) => {
              const active = tab === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setT(v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand sm:text-sm ${
                    active
                      ? 'bg-brand-soft text-brand'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {tabMeta[v].icon}
                  <span>{tabMeta[v].label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <CompetitionTabs group={group} onChange={setGroup} />
      </header>

      {/* -------------------------------------- Era Summary Highlight Strip */}
      {highlights.activeCount > 0 && (
        <section
          aria-label={L('สรุปสถิติเด่นของยุคสมัย', 'Era summary highlights')}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* 1. Current Manager Spotlight */}
          {highlights.current && (
            <article
              className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: 'var(--brand)' }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand">
                    <UserCheck size={13} />
                    {isCurrent(highlights.current.stint)
                      ? L('ผู้จัดการปัจจุบัน', 'Current Manager')
                      : L('ผู้จัดการล่าสุด', 'Latest Manager')}
                  </span>
                  {highlights.current.stint.interim && (
                    <span className="rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
                      {L('รักษาการ', 'Interim')}
                    </span>
                  )}
                </div>
                <h2 className="mt-2 truncate font-display text-lg font-bold text-primary">
                  {displayName(highlights.current.stint, lang)}
                </h2>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold tabular-nums text-primary">
                    {fmt(curPpg, 2)}
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {L('แต้ม/นัด', 'PPG')} · {highlights.current.w}–{highlights.current.d}–{highlights.current.l}
                  </span>
                </div>
              </div>
              <div>
                <MiniWdlBar s={highlights.current} />
                <p className="mt-2 flex items-center justify-between text-xs text-muted tabular-nums">
                  <span>{highlights.current.mp} {L('นัด', 'MP')}</span>
                  <span>{tenureDuration(daysInCharge(highlights.current.stint), lang)}</span>
                </p>
              </div>
            </article>
          )}

          {/* 2. Highest PPG */}
          {highlights.bestPpg && (
            <article
              className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: 'var(--brand)' }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <Flame size={13} className="text-brand" />
                    {highlights.usingQualified
                      ? L(`แต้ม/นัดสูงสุด (≥${minN} นัด)`, `Highest PPG (min ${minN})`)
                      : L('แต้ม/นัดสูงสุด', 'Highest PPG')}
                  </span>
                </div>
                <h2 className="mt-2 truncate font-display text-lg font-bold text-primary">
                  {displayName(highlights.bestPpg.stint, lang)}
                </h2>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold tabular-nums text-success">
                    {fmt(bestPpgVal, 2)}
                  </span>
                  {bestPpgDelta != null && (
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        bestPpgDelta >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {signed(bestPpgDelta, 2)} {L('เทียบเฉลี่ย', 'vs avg')}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <MiniWdlBar s={highlights.bestPpg} />
                <p className="mt-2 flex items-center justify-between text-xs text-muted tabular-nums">
                  <span>{highlights.bestPpg.mp} {L('นัด', 'MP')}</span>
                  <span>{periodShort(highlights.bestPpg.stint, lang)}</span>
                </p>
              </div>
            </article>
          )}

          {/* 3. Best Win % */}
          {highlights.bestWin && (
            <article
              className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: 'var(--brand)' }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <Award size={13} className="text-brand" />
                    {highlights.usingQualified
                      ? L(`อัตราชนะสูงสุด (≥${minN} นัด)`, `Best Win % (min ${minN})`)
                      : L('อัตราชนะสูงสุด', 'Best Win %')}
                  </span>
                </div>
                <h2 className="mt-2 truncate font-display text-lg font-bold text-primary">
                  {displayName(highlights.bestWin.stint, lang)}
                </h2>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold tabular-nums text-primary">
                    {pct(winRate(highlights.bestWin), 2)}
                  </span>
                  <span className="text-xs font-medium text-muted tabular-nums">
                    {highlights.bestWin.w}W–{highlights.bestWin.d}D–{highlights.bestWin.l}L
                  </span>
                </div>
              </div>
              <div>
                <MiniWdlBar s={highlights.bestWin} />
                <p className="mt-2 flex items-center justify-between text-xs text-muted tabular-nums">
                  <span>{highlights.bestWin.mp} {L('นัด', 'MP')}</span>
                  <span>{periodShort(highlights.bestWin.stint, lang)}</span>
                </p>
              </div>
            </article>
          )}

          {/* 4. Longest Tenure */}
          {highlights.longest && (
            <article
              className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm dark:shadow-none"
              style={{ borderTopWidth: 2, borderTopColor: 'var(--brand)' }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <Clock size={13} className="text-brand" />
                    {L('คุมทีมยาวนานที่สุด', 'Longest Tenure')}
                  </span>
                </div>
                <h2 className="mt-2 truncate font-display text-lg font-bold text-primary">
                  {displayName(highlights.longest.stint, lang)}
                </h2>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold tabular-nums text-primary">
                    {highlights.longest.mp}
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {L('นัด', 'matches')} · {tenureDuration(daysInCharge(highlights.longest.stint), lang)}
                  </span>
                </div>
              </div>
              <div>
                <MiniWdlBar s={highlights.longest} />
                <p className="mt-2 flex items-center justify-between text-xs text-muted tabular-nums">
                  <span>{fmt(ppg(highlights.longest), 2)} {L('แต้ม/นัด', 'PPG')}</span>
                  <span>{periodShort(highlights.longest.stint, lang)}</span>
                </p>
              </div>
            </article>
          )}
        </section>
      )}

      {/* --------------------------------------------------------- Active View */}
      <Fade key={tab}>
        {tab === 'eras' && <VariantA {...props} />}
        {tab === 'leaderboard' && <VariantB {...props} />}
        {tab === 'h2h' && <VariantC {...props} />}
        {tab === 'classic' && <ManagersClient group={group} />}
      </Fade>
    </main>
  );
}

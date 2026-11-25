'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Link2,
  Scale,
  Share2,
  Sparkles,
  Swords,
  Target,
  Users,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useTheme } from '@/components/ThemeProvider';
import type { ClubIndexEntry } from '@/lib/types';
import { fmt } from '@/lib/format';
import { seasonShort } from '@/lib/stats';
import { ClubCrest, PlayerPicker } from './PlayerPicker';
import { ProfileVisuals } from './ProfileVisuals';
import { LeagueScatter } from './LeagueScatter';
import { CareerTrajectory } from './CareerTrajectory';
import {
  CAT_META,
  DEMO_METRICS,
  FEATURED_MATCHUPS,
  PIZZA_METRICS,
  POS_LABELS,
  buildDemoPool,
  detectArchetypes,
  findSimilarPlayers,
  formatDelta,
  formatMetricVal,
  profileOverlapScore,
  rankInPool,
  rawMetricVal,
  resolvePairColors,
  type CatId,
  type DemoMetric,
  type DemoPlayer,
  type PcSeason,
  type PeerScope,
  type ViewMode,
} from './types';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function pctChipClass(pct: number | null): string {
  if (pct == null) return 'bg-bg-secondary text-muted';
  if (pct >= 85) return 'bg-success-soft text-success';
  if (pct >= 65) return 'bg-info-soft text-info';
  if (pct >= 40) return 'bg-bg-secondary text-primary';
  return 'bg-bg-secondary text-muted';
}

function archetypeToneClass(tone: 'scoring' | 'creation' | 'shooting' | 'avail'): string {
  switch (tone) {
    case 'scoring':
      return 'border-danger/25 bg-danger-soft/70 text-danger';
    case 'creation':
      return 'border-info/25 bg-info-soft/70 text-info';
    case 'shooting':
      return 'border-warning/25 bg-warning-soft/70 text-warning';
    case 'avail':
      return 'border-success/25 bg-success-soft/70 text-success';
  }
}

export function PlayersCompare({
  clubs,
  seasons,
  initialSeasons,
  defaultSeason,
}: {
  clubs: ClubIndexEntry[];
  seasons: string[];
  initialSeasons: Record<string, PcSeason>;
  defaultSeason: string;
}) {
  const { lang } = useI18n();
  const { theme } = useTheme();
  const th = lang === 'th';
  const dark = theme === 'dark';
  const tx = (en: string, t: string) => (th ? t : en);

  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.slug, c])), [clubs]);

  const [seasonsCache, setSeasonsCache] = useState<Record<string, PcSeason>>(initialSeasons);
  const cacheRef = useRef<Record<string, PcSeason>>(initialSeasons);
  const inflightRef = useRef<Set<string>>(new Set());

  const [seasonA, setSeasonA] = useState<string>(defaultSeason);
  const [seasonB, setSeasonB] = useState<string>(defaultSeason);
  const [keyA, setKeyA] = useState<string>('man-city|Erling Haaland');
  const [keyB, setKeyB] = useState<string>('man-utd|Bruno Fernandes');

  const [viewMode, setViewMode] = useState<ViewMode>('per90');
  const [peerScope, setPeerScope] = useState<PeerScope>('pos');
  const [catFilter, setCatFilter] = useState<'all' | CatId>('all');
  const [copied, setCopied] = useState(false);
  const urlReadyRef = useRef(false);

  const loadingA = !seasonsCache[seasonA];
  const loadingB = !seasonsCache[seasonB];
  const loadingAll = useMemo(() => seasons.some((s) => !seasonsCache[s]), [seasons, seasonsCache]);

  const ensureSeason = useCallback(async (s: string): Promise<PcSeason | null> => {
    if (cacheRef.current[s]) return cacheRef.current[s];
    if (inflightRef.current.has(s)) return null;
    inflightRef.current.add(s);
    try {
      const res = await fetch(`${BASE_PATH}/data/players-compare/${s}.json`);
      if (!res.ok) return null;
      const d = (await res.json()) as PcSeason;
      cacheRef.current = { ...cacheRef.current, [s]: d };
      setSeasonsCache((prev) => ({ ...prev, [s]: d }));
      return d;
    } catch {
      return null;
    } finally {
      inflightRef.current.delete(s);
    }
  }, []);

  // Hydrate matchup from URL query params once on mount (async microtask avoids sync setState-in-effect)
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      try {
        const sp = new URLSearchParams(window.location.search);
        const sa = sp.get('sa');
        const sb = sp.get('sb');
        const a = sp.get('a');
        const b = sp.get('b');
        if (sa && seasons.includes(sa)) setSeasonA(sa);
        if (sb && seasons.includes(sb)) setSeasonB(sb);
        if (a) setKeyA(a);
        if (b) setKeyB(b);
      } catch {
        // ignore
      } finally {
        urlReadyRef.current = true;
      }
    });
    return () => {
      alive = false;
    };
  }, [seasons]);

  // Fetch active seasons on demand
  useEffect(() => {
    if (!cacheRef.current[seasonA]) {
      void ensureSeason(seasonA);
    }
  }, [seasonA, ensureSeason]);

  useEffect(() => {
    if (!cacheRef.current[seasonB]) {
      void ensureSeason(seasonB);
    }
  }, [seasonB, ensureSeason]);

  // Lazily prefetch remaining seasons in background for Career Trajectory
  useEffect(() => {
    const missing = seasons.filter((s) => !cacheRef.current[s]);
    if (!missing.length) return;
    void Promise.all(missing.map((s) => ensureSeason(s)));
  }, [seasons, ensureSeason]);

  // Sync URL cleanly when matchup changes
  useEffect(() => {
    if (!urlReadyRef.current) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('sa', seasonA);
      url.searchParams.set('a', keyA);
      url.searchParams.set('sb', seasonB);
      url.searchParams.set('b', keyB);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }
  }, [seasonA, seasonB, keyA, keyB]);

  const poolA = useMemo(() => {
    const raw = seasonsCache[seasonA] ?? initialSeasons[defaultSeason];
    return raw ? buildDemoPool(raw) : [];
  }, [seasonsCache, seasonA, initialSeasons, defaultSeason]);

  const poolB = useMemo(() => {
    const raw = seasonsCache[seasonB] ?? initialSeasons[defaultSeason];
    return raw ? buildDemoPool(raw) : [];
  }, [seasonsCache, seasonB, initialSeasons, defaultSeason]);

  const sortedA = useMemo(
    () => [...poolA].sort((a, b) => b.min - a.min).sort((a, b) => Number(b.eligible) - Number(a.eligible)),
    [poolA],
  );
  const sortedB = useMemo(
    () => [...poolB].sort((a, b) => b.min - a.min).sort((a, b) => Number(b.eligible) - Number(a.eligible)),
    [poolB],
  );

  const pickBest = (pool: DemoPlayer[], preferredKey: string, fallbackIdx: number): DemoPlayer | null => {
    const exact = pool.find((p) => p.key === preferredKey);
    if (exact) return exact;
    const preferredName = preferredKey.split('|')[1];
    if (preferredName) {
      const sameName = pool
        .filter((p) => p.name === preferredName)
        .sort((x, y) => y.min - x.min)[0];
      if (sameName) return sameName;
    }
    const top = pool
      .filter((p) => p.eligible && p.v.ga90 != null)
      .sort((a, b) => (b.v.ga90 ?? 0) - (a.v.ga90 ?? 0));
    return top[fallbackIdx] ?? pool[fallbackIdx] ?? pool[0] ?? null;
  };

  const A = useMemo(() => pickBest(poolA, keyA, 0), [poolA, keyA]);
  const B = useMemo(() => pickBest(poolB, keyB, 1), [poolB, keyB]);

  const { colorA, colorB } = useMemo(
    () => resolvePairColors(A ? clubMap.get(A.club) : undefined, B ? clubMap.get(B.club) : undefined, dark),
    [A, B, clubMap, dark],
  );

  // H2H edge analysis across PIZZA_METRICS
  const edgeAnalysis = useMemo(() => {
    if (!A || !B) return null;
    let winsA = 0;
    let winsB = 0;
    let ties = 0;
    const rows: {
      m: DemoMetric;
      pctA: number | null;
      pctB: number | null;
      valA: number | null;
      valB: number | null;
      winner: 0 | 1 | 2;
      gap: number;
    }[] = [];

    for (const m of PIZZA_METRICS) {
      const va = A.v[m.id];
      const vb = B.v[m.id];
      const pa = rankInPool(poolA, A, m, peerScope).pct;
      const pb = rankInPool(poolB, B, m, peerScope).pct;
      let winner: 0 | 1 | 2 = 0;
      if (va != null && vb != null && Math.abs(va - vb) >= 0.005) {
        winner = (m.lowerBetter ? va < vb : va > vb) ? 1 : 2;
      }
      if (winner === 1) winsA++;
      else if (winner === 2) winsB++;
      else ties++;
      rows.push({
        m,
        pctA: pa,
        pctB: pb,
        valA: va,
        valB: vb,
        winner,
        gap: pa != null && pb != null ? Math.abs(pa - pb) : 0,
      });
    }

    const topA = rows
      .filter((r) => r.winner === 1)
      .sort((x, y) => y.gap - x.gap)
      .slice(0, 3);
    const topB = rows
      .filter((r) => r.winner === 2)
      .sort((x, y) => y.gap - x.gap)
      .slice(0, 3);
    const closest = [...rows].sort((x, y) => x.gap - y.gap).slice(0, 2);
    const overlap = profileOverlapScore(A, poolA, B, poolB, peerScope);

    return { winsA, winsB, ties, topA, topB, closest, overlap };
  }, [A, B, poolA, poolB, peerScope]);

  const archetypesA = useMemo(() => (A ? detectArchetypes(A, poolA) : []), [A, poolA]);
  const archetypesB = useMemo(() => (B ? detectArchetypes(B, poolB) : []), [B, poolB]);

  const similarA = useMemo(
    () => (A ? findSimilarPlayers(A, poolA, [A.key, seasonA === seasonB && B ? B.key : ''], 5) : []),
    [A, B, poolA, seasonA, seasonB],
  );
  const similarB = useMemo(
    () => (B ? findSimilarPlayers(B, poolB, [B.key, seasonA === seasonB && A ? A.key : ''], 5) : []),
    [A, B, poolB, seasonA, seasonB],
  );

  if (!A || !B || !edgeAnalysis) {
    return (
      <main className="mx-auto w-full max-w-[1320px] px-4 py-16 text-center text-sm text-muted">
        {tx('Loading player data…', 'กำลังโหลดข้อมูลนักเตะ…')}
      </main>
    );
  }

  const clubName = (slug: string) => {
    const c = clubMap.get(slug);
    return th ? c?.nameTh ?? c?.name ?? slug : c?.name ?? slug;
  };

  const applyPreset = (preset: (typeof FEATURED_MATCHUPS)[number]) => {
    setSeasonA(preset.seasonA);
    setSeasonB(preset.seasonB);
    setKeyA(preset.keyA);
    setKeyB(preset.keyB);
  };

  const swapPlayers = () => {
    setSeasonA(seasonB);
    setSeasonB(seasonA);
    setKeyA(B.key);
    setKeyB(A.key);
  };

  const syncSeasons = () => {
    setSeasonB(seasonA);
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const headlinerIds = ['gls90', 'ast90', 'ga90', 'sh90', 'sotPct', 'min'];
  const headlinerMetrics = headlinerIds
    .map((id) => DEMO_METRICS.find((m) => m.id === id))
    .filter((m): m is DemoMetric => Boolean(m));

  const visibleCats =
    catFilter === 'all' ? CAT_META : CAT_META.filter((c) => c.id === catFilter);

  const crossSeason = seasonA !== seasonB;

  const renderContributionBar = (p: DemoPlayer, s: string, color: string) => {
    const npg = Math.max(0, p.gls - p.pk);
    const total = Math.max(1, npg + p.pk + p.ast);
    const npgW = (npg / total) * 100;
    const pkW = (p.pk / total) * 100;
    const astW = (p.ast / total) * 100;
    const hasOutput = npg + p.pk + p.ast > 0;
    return (
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-bold text-primary">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {p.name}
            <span className="font-normal text-muted">{seasonShort(s)}</span>
          </span>
          <span className="font-bold tabular-nums text-primary">
            {p.gls + p.ast} {tx('G+A', 'G+A')}
          </span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-bg-secondary">
          {hasOutput && (
            <>
              <div
                style={{ width: `${npgW}%`, background: color }}
                title={`${tx('Non-penalty goals', 'ประตูไม่รวมจุดโทษ')}: ${npg}`}
              />
              <div
                style={{ width: `${pkW}%`, background: color, opacity: 0.55 }}
                title={`${tx('Penalties', 'จุดโทษ')}: ${p.pk}`}
              />
              <div
                style={{ width: `${astW}%`, background: color, opacity: 0.25 }}
                title={`${tx('Assists', 'แอสซิสต์')}: ${p.ast}`}
              />
            </>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular-nums text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs" style={{ background: color }} />
            {tx('Open-play G', 'ประตูโอเพนเพลย์')}: <strong className="text-primary">{npg}</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs" style={{ background: color, opacity: 0.55 }} />
            {tx('Penalties', 'จุดโทษ')}: <strong className="text-primary">{p.pk}/{p.pkatt}</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs" style={{ background: color, opacity: 0.28 }} />
            {tx('Assists', 'แอสซิสต์')}: <strong className="text-primary">{p.ast}</strong>
          </span>
        </div>
      </div>
    );
  };

  return (
    <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      {/* --------------------------------------------------- Masthead */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Premier League · 2014–2027 · {tx('Scouting & Comparison', 'วิเคราะห์และเปรียบเทียบนักเตะ')}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {tx('Player Comparison', 'เปรียบเทียบนักเตะ')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            {tx(
              'Compare any two Premier League outfield players across clubs or across eras — with percentile profiles, league scatter context, career arcs and statistical twins.',
              'เจาะลึกเปรียบเทียบนักเตะเอาท์ฟิลด์พรีเมียร์ลีกข้ามสโมสรและข้ามยุค (2014–2027) พร้อมกราฟเปอร์เซ็นไทล์ แผนที่ทั้งลีก เส้นทางอาชีพ และค้นหานักเตะสไตล์ใกล้เคียง',
            )}
          </p>
        </div>

        {/* Global controls: Per 90 / Totals + Share */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('per90')}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                viewMode === 'per90'
                  ? 'bg-primary text-surface'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {tx('Per 90', 'ต่อ 90 นาที')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('totals')}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                viewMode === 'totals'
                  ? 'bg-primary text-surface'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {tx('Season Totals', 'รวมทั้งฤดูกาล')}
            </button>
          </div>

          <button
            type="button"
            onClick={copyShareUrl}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:border-primary/40 hover:bg-bg-secondary"
          >
            {copied ? <Check size={14} className="text-success" /> : <Share2 size={14} />}
            <span>{copied ? tx('Link copied', 'คัดลอกลิงก์แล้ว') : tx('Share matchup', 'แชร์คู่นี้')}</span>
          </button>
        </div>
      </header>

      {/* --------------------------------------- Curated Quick Matchups */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          <Sparkles size={13} className="text-brand" />
          {tx('Featured:', 'คู่เด่น:')}
        </span>
        {FEATURED_MATCHUPS.map((fm) => {
          const active =
            seasonA === fm.seasonA &&
            seasonB === fm.seasonB &&
            A.key === fm.keyA &&
            B.key === fm.keyB;
          return (
            <button
              key={fm.id}
              type="button"
              onClick={() => applyPreset(fm)}
              className={`group flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all ${
                active
                  ? 'border-brand bg-brand-soft font-bold text-brand'
                  : 'border-border bg-surface text-secondary hover:border-primary/30 hover:text-primary'
              }`}
            >
              <span className="font-semibold">{th ? fm.th : fm.en}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? 'bg-surface/80 text-brand' : 'bg-bg-secondary text-muted'
                }`}
              >
                {th ? fm.tagTh : fm.tagEn}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------------------------------- Split Tale-of-the-Tape Hero */}
      <section className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
        {/* Subtle dual-club tint header wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-[0.10] dark:opacity-[0.16]"
          style={{
            background: `linear-gradient(105deg, ${colorA} 0%, transparent 46%, transparent 54%, ${colorB} 100%)`,
          }}
        />

        {/* Picker Bar */}
        <div className="relative z-20 flex flex-col gap-3 border-b border-border/80 px-4 py-4 sm:flex-row sm:items-end sm:px-6">
          <PlayerPicker
            sideLabel={tx('Player A', 'นักเตะ A')}
            color={colorA}
            player={A}
            season={seasonA}
            seasons={seasons}
            list={sortedA}
            clubs={clubMap}
            th={th}
            loading={loadingA}
            onPickPlayer={(p) => setKeyA(p.key)}
            onPickSeason={(s) => setSeasonA(s)}
          />

          <div className="flex items-center justify-center gap-2 sm:mb-0.5 sm:flex-col">
            <button
              type="button"
              onClick={swapPlayers}
              aria-label={tx('Swap players', 'สลับฝั่งนักเตะ')}
              title={tx('Swap players', 'สลับฝั่งนักเตะ')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-primary transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
            >
              <ArrowLeftRight size={16} />
            </button>
            {crossSeason && (
              <button
                type="button"
                onClick={syncSeasons}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted transition-colors hover:text-primary"
                title={tx('Sync both to Player A season', 'ปรับให้ใช้ฤดูกาลเดียวกัน')}
              >
                <Link2 size={10} />
                {tx('Sync', 'ซิงก์ปี')}
              </button>
            )}
          </div>

          <PlayerPicker
            sideLabel={tx('Player B', 'นักเตะ B')}
            color={colorB}
            player={B}
            season={seasonB}
            seasons={seasons}
            list={sortedB}
            clubs={clubMap}
            th={th}
            loading={loadingB}
            onPickPlayer={(p) => setKeyB(p.key)}
            onPickSeason={(s) => setSeasonB(s)}
          />
        </div>

        {/* Tale-of-the-Tape Identity Stage */}
        <div
          className={`relative z-10 grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1fr_240px_1fr] lg:items-center ${
            loadingA || loadingB ? 'opacity-60' : ''
          }`}
        >
          {/* Player A Identity */}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-surface p-2"
                style={{ borderColor: `color-mix(in srgb, ${colorA} 38%, var(--border))` }}
              >
                <ClubCrest slug={A.club} size={38} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ background: colorA }}
                  >
                    PL {seasonShort(seasonA)}
                  </span>
                  <span className="truncate text-xs font-semibold text-secondary">
                    {clubName(A.club)}
                  </span>
                </div>
                <h2 className="mt-1 truncate font-display text-2xl font-bold leading-tight text-primary sm:text-[28px]">
                  {A.name}
                </h2>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted tabular-nums">
              <span className="rounded-md bg-bg-secondary px-2 py-0.5 font-bold text-primary">
                {th ? POS_LABELS[A.pos].th : A.posRaw}
              </span>
              {A.age != null && (
                <span>
                  {tx('Age', 'อายุ')} <strong className="text-primary">{A.age}</strong>
                </span>
              )}
              <span>
                <strong className="text-primary">{A.starts}</strong>/{A.mp}{' '}
                {tx('starts', 'ตัวจริง')}
              </span>
              <span>
                <strong className="text-primary">{A.min}</strong> {tx('mins', 'นาที')} (
                {fmt(A.v.share, 2)}%)
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {archetypesA.map((b) => (
                <span
                  key={b.id}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${archetypeToneClass(b.tone)}`}
                >
                  {th ? b.th : b.en}
                </span>
              ))}
            </div>

            {!A.eligible && (
              <p className="mt-2 text-xs font-medium text-warning">
                {tx(
                  'Small sample: played under 30% of team max minutes.',
                  'ตัวอย่างน้อย: ลงเล่นไม่ถึง 30% ของนาทีสูงสุดในทีม',
                )}
              </p>
            )}
          </div>

          {/* Center Scoreboard & Similarity */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-bg-secondary/75 px-4 py-4 text-center">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              <Swords size={12} />
              {tx('Profile Edge (10 metrics)', 'ผลเทียบ 10 มิติหลัก')}
            </div>

            <div className="mt-2 flex items-baseline gap-3 tabular-nums">
              <span className="text-3xl font-extrabold" style={{ color: colorA }}>
                {edgeAnalysis.winsA}
              </span>
              <span className="text-xs font-bold text-muted">
                {edgeAnalysis.ties > 0 ? `(${edgeAnalysis.ties} =)` : '—'}
              </span>
              <span className="text-3xl font-extrabold" style={{ color: colorB }}>
                {edgeAnalysis.winsB}
              </span>
            </div>

            {/* Proportional bar */}
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-border/60">
              <div
                style={{
                  width: `${(edgeAnalysis.winsA / PIZZA_METRICS.length) * 100}%`,
                  background: colorA,
                }}
              />
              <div
                style={{
                  width: `${(edgeAnalysis.ties / PIZZA_METRICS.length) * 100}%`,
                  background: 'var(--chart-neutral)',
                  opacity: 0.4,
                }}
              />
              <div
                style={{
                  width: `${(edgeAnalysis.winsB / PIZZA_METRICS.length) * 100}%`,
                  background: colorB,
                }}
              />
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
              <span>{tx('Style overlap:', 'สไตล์ใกล้เคียง:')}</span>
              <strong className="tabular-nums text-primary">{edgeAnalysis.overlap}%</strong>
            </div>
            {crossSeason && (
              <span className="mt-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                {tx('Cross-Season Mode', 'โหมดเทียบข้ามฤดูกาล')}
              </span>
            )}
          </div>

          {/* Player B Identity */}
          <div className="min-w-0 lg:text-right">
            <div className="flex items-center gap-3 lg:flex-row-reverse">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-surface p-2"
                style={{ borderColor: `color-mix(in srgb, ${colorB} 38%, var(--border))` }}
              >
                <ClubCrest slug={B.club} size={38} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className="truncate text-xs font-semibold text-secondary">
                    {clubName(B.club)}
                  </span>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ background: colorB }}
                  >
                    PL {seasonShort(seasonB)}
                  </span>
                </div>
                <h2 className="mt-1 truncate font-display text-2xl font-bold leading-tight text-primary sm:text-[28px]">
                  {B.name}
                </h2>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted tabular-nums lg:justify-end">
              <span className="rounded-md bg-bg-secondary px-2 py-0.5 font-bold text-primary">
                {th ? POS_LABELS[B.pos].th : B.posRaw}
              </span>
              {B.age != null && (
                <span>
                  {tx('Age', 'อายุ')} <strong className="text-primary">{B.age}</strong>
                </span>
              )}
              <span>
                <strong className="text-primary">{B.starts}</strong>/{B.mp}{' '}
                {tx('starts', 'ตัวจริง')}
              </span>
              <span>
                <strong className="text-primary">{B.min}</strong> {tx('mins', 'นาที')} (
                {fmt(B.v.share, 2)}%)
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 lg:justify-end">
              {archetypesB.map((b) => (
                <span
                  key={b.id}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${archetypeToneClass(b.tone)}`}
                >
                  {th ? b.th : b.en}
                </span>
              ))}
            </div>

            {!B.eligible && (
              <p className="mt-2 text-xs font-medium text-warning">
                {tx(
                  'Small sample: played under 30% of team max minutes.',
                  'ตัวอย่างน้อย: ลงเล่นไม่ถึง 30% ของนาทีสูงสุดในทีม',
                )}
              </p>
            )}
          </div>
        </div>

        {/* Headliner Stat Ribbon attached to Hero */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border bg-bg-secondary/45 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          {headlinerMetrics.map((m) => {
            const va = rawMetricVal(m, A, viewMode);
            const vb = rawMetricVal(m, B, viewMode);
            const winner =
              va == null || vb == null || Math.abs(va - vb) < 0.005
                ? 0
                : (m.lowerBetter ? va < vb : va > vb)
                ? 1
                : 2;
            const label =
              viewMode === 'totals' && m.totalEn
                ? th
                  ? m.totalTh ?? m.th
                  : m.totalEn
                : th
                ? m.th
                : m.en;
            return (
              <div key={m.id} className="px-3.5 py-3.5 text-center">
                <p className="truncate text-[11px] font-semibold text-muted">{label}</p>
                <div className="mt-2 flex items-baseline justify-center gap-3 tabular-nums">
                  <span
                    className={`text-lg font-extrabold ${
                      winner === 2 ? 'opacity-50' : ''
                    }`}
                    style={{ color: colorA }}
                  >
                    {formatMetricVal(m, A, viewMode)}
                  </span>
                  <span className="text-[10px] text-border">/</span>
                  <span
                    className={`text-lg font-extrabold ${
                      winner === 1 ? 'opacity-50' : ''
                    }`}
                    style={{ color: colorB }}
                  >
                    {formatMetricVal(m, B, viewMode)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------- Interactive Profiles */}
      <div className="mt-6">
        <ProfileVisuals
          A={A}
          B={B}
          seasonA={seasonA}
          seasonB={seasonB}
          poolA={poolA}
          poolB={poolB}
          clubs={clubMap}
          colorA={colorA}
          colorB={colorB}
          scope={peerScope}
          onScopeChange={setPeerScope}
          th={th}
        />
      </div>

      {/* ------------------------ Scouting Verdict + Output/Shot Funnel */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Left: Automated Scouting Verdict */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-7">
          <div className="border-b border-border pb-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              <Scale size={13} />
              {tx('Automated Scouting Readout', 'สรุปความได้เปรียบจากข้อมูล')}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
              {tx('Where the Matchup is Won', 'จุดชี้ขาดของคู่นี้')}
            </h2>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Player A's edges */}
            <div className="rounded-xl border border-border bg-bg-secondary/50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorA }} />
                <span className="truncate">
                  {tx(`${A.name}'s biggest edges`, `จุดแข็งของ ${A.name}`)}
                </span>
              </div>
              {edgeAnalysis.topA.length ? (
                <ul className="mt-3 space-y-2.5">
                  {edgeAnalysis.topA.map(({ m, pctA, pctB }) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-secondary">{th ? m.th : m.en}</span>
                      <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                        <strong style={{ color: colorA }}>{formatMetricVal(m, A, 'per90')}</strong>
                        <span className="text-muted">vs</span>
                        <span className="text-muted">{formatMetricVal(m, B, 'per90')}</span>
                        {pctA != null && pctB != null && (
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {pctA - pctB >= 0 ? `+${pctA - pctB}` : pctA - pctB}p
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {tx('No clear per-90 advantages across the 10 profile axes.', 'ไม่มีหมวดที่ได้เปรียบชัดเจนใน 10 มิติหลัก')}
                </p>
              )}
            </div>

            {/* Player B's edges */}
            <div className="rounded-xl border border-border bg-bg-secondary/50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorB }} />
                <span className="truncate">
                  {tx(`${B.name}'s biggest edges`, `จุดแข็งของ ${B.name}`)}
                </span>
              </div>
              {edgeAnalysis.topB.length ? (
                <ul className="mt-3 space-y-2.5">
                  {edgeAnalysis.topB.map(({ m, pctA, pctB }) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-secondary">{th ? m.th : m.en}</span>
                      <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                        <strong style={{ color: colorB }}>{formatMetricVal(m, B, 'per90')}</strong>
                        <span className="text-muted">vs</span>
                        <span className="text-muted">{formatMetricVal(m, A, 'per90')}</span>
                        {pctA != null && pctB != null && (
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {pctB - pctA >= 0 ? `+${pctB - pctA}` : pctB - pctA}p
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {tx('No clear per-90 advantages across the 10 profile axes.', 'ไม่มีหมวดที่ได้เปรียบชัดเจนใน 10 มิติหลัก')}
                </p>
              )}
            </div>
          </div>

          {/* Closest / evenly matched traits */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 px-4 py-2.5 text-xs">
            <span className="font-semibold text-muted">
              {tx('Closest categories:', 'หมวดที่สูสีที่สุด:')}
            </span>
            <div className="flex flex-wrap gap-3 tabular-nums">
              {edgeAnalysis.closest.map(({ m }) => (
                <span key={m.id} className="text-secondary">
                  <strong className="text-primary">{th ? m.shortTh : m.shortEn}</strong> (
                  {formatMetricVal(m, A, 'per90')} vs {formatMetricVal(m, B, 'per90')})
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Output Anatomy + Shot Funnel */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:col-span-5">
          <div className="border-b border-border pb-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              <Target size={13} />
              {tx('Output & Shot Funnel', 'โครงสร้างผลงานและการจบสกอร์')}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
              {tx('How Output Is Built', 'ที่มาของประตูและโอกาสยิง')}
            </h2>
          </div>

          <div className="mt-4 space-y-4">
            {renderContributionBar(A, seasonA, colorA)}
            {renderContributionBar(B, seasonB, colorB)}
          </div>

          {/* Shot Conversion Funnel Table */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              {tx('Shooting Funnel (Totals & Conversion)', 'เส้นทางการยิง (รวมทั้งฤดูกาล & อัตราเปลี่ยนเป็นประตู)')}
            </p>
            <div className="overflow-hidden rounded-xl border border-border text-xs tabular-nums">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-bg-secondary px-3 py-2 text-[11px] font-bold text-muted">
                <span>{tx('Stage', 'ขั้นตอน')}</span>
                <span className="text-right" style={{ color: colorA }}>
                  {A.name.split(' ').slice(-1)[0]}
                </span>
                <span className="text-right" style={{ color: colorB }}>
                  {B.name.split(' ').slice(-1)[0]}
                </span>
              </div>
              {[
                {
                  en: 'Total Shots',
                  th: 'โอกาสยิงทั้งหมด',
                  a: `${A.sh}`,
                  b: `${B.sh}`,
                },
                {
                  en: 'On Target (Acc %)',
                  th: 'ยิงตรงกรอบ (แม่นยำ %)',
                  a: `${A.sot} (${fmt(A.v.sotPct, 2)}%)`,
                  b: `${B.sot} (${fmt(B.v.sotPct, 2)}%)`,
                },
                {
                  en: 'Goals (Conv %)',
                  th: 'ประตู (คม %)',
                  a: `${A.gls} (${A.sh > 0 ? `${fmt((A.gls / A.sh) * 100, 2)}%` : '—'})`,
                  b: `${B.gls} (${B.sh > 0 ? `${fmt((B.gls / B.sh) * 100, 2)}%` : '—'})`,
                },
              ].map((row) => (
                <div
                  key={row.en}
                  className="grid grid-cols-[1.2fr_1fr_1fr] border-t border-border px-3 py-2"
                >
                  <span className="text-secondary">{th ? row.th : row.en}</span>
                  <span className="text-right font-semibold text-primary">{row.a}</span>
                  <span className="text-right font-semibold text-primary">{row.b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* --------------------------------------- League Context Scatter */}
      <div className="mt-6">
        <LeagueScatter
          A={A}
          B={B}
          seasonA={seasonA}
          seasonB={seasonB}
          poolA={poolA}
          clubs={clubMap}
          colorA={colorA}
          colorB={colorB}
          scope={peerScope}
          th={th}
          onPickFromScatter={(slot, p, s) => {
            if (slot === 'A') {
              setSeasonA(s);
              setKeyA(p.key);
            } else {
              setSeasonB(s);
              setKeyB(p.key);
            }
          }}
        />
      </div>

      {/* --------------------------------- Complete Metric Comparison */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {tx('Full Statistical Breakdown', 'ตารางสถิติเทียบแบบละเอียด')} ·{' '}
              {viewMode === 'per90' ? tx('Per 90', 'ต่อ 90 นาที') : tx('Season Totals', 'รวมทั้งฤดูกาล')}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
              {tx('Head-to-Head Metric Tug-of-War', 'เปรียบเทียบรายตัวชี้วัดพร้อมเปอร์เซ็นไทล์')}
            </h2>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCatFilter('all')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                catFilter === 'all'
                  ? 'border-primary bg-primary text-surface'
                  : 'border-border bg-bg-secondary text-secondary hover:text-primary'
              }`}
            >
              {tx('All', 'ทั้งหมด')}
            </button>
            {CAT_META.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  catFilter === c.id
                    ? 'border-primary bg-primary text-surface'
                    : 'border-border bg-bg-secondary text-secondary hover:text-primary'
                }`}
              >
                {th ? c.th : c.en}
              </button>
            ))}
          </div>
        </div>

        {/* Column Header */}
        <div className="mt-4 hidden grid-cols-[3rem_4.75rem_1fr_13rem_1fr_4.75rem_3rem] items-center gap-2 px-1 text-xs font-bold md:grid">
          <span className="text-center text-[10px] uppercase text-muted">Pct</span>
          <span className="col-span-2 truncate text-right" style={{ color: colorA }}>
            {A.name} ({seasonShort(seasonA)})
          </span>
          <span className="text-center text-[10px] uppercase text-muted">
            {tx('Metric & Delta', 'ตัวชี้วัด & ส่วนต่าง')}
          </span>
          <span className="col-span-2 truncate" style={{ color: colorB }}>
            {B.name} ({seasonShort(seasonB)})
          </span>
          <span className="text-center text-[10px] uppercase text-muted">Pct</span>
        </div>

        {visibleCats.map((cat) => (
          <div key={cat.id} className="mt-4 border-t border-border pt-3 first:mt-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: cat.accent }} />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                {th ? cat.th : cat.en}
              </h3>
            </div>

            <div className="divide-y divide-border/70">
              {DEMO_METRICS.filter((m) => m.cat === cat.id).map((m) => {
                const va = rawMetricVal(m, A, viewMode);
                const vb = rawMetricVal(m, B, viewMode);
                const mx = Math.max(va ?? 0, vb ?? 0) || 1;
                const winner =
                  va == null || vb == null || Math.abs(va - vb) < 0.005
                    ? 0
                    : (m.lowerBetter ? va < vb : va > vb)
                    ? 1
                    : 2;
                const rA = m.pizza ? rankInPool(poolA, A, m, peerScope).pct : null;
                const rB = m.pizza ? rankInPool(poolB, B, m, peerScope).pct : null;
                const diff = va != null && vb != null ? va - vb : null;
                const label =
                  viewMode === 'totals' && m.totalEn
                    ? th
                      ? m.totalTh ?? m.th
                      : m.totalEn
                    : th
                    ? m.th
                    : m.en;

                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 py-2.5 text-xs md:grid-cols-[3rem_4.75rem_1fr_13rem_1fr_4.75rem_3rem]"
                  >
                    {/* A Percentile */}
                    <div className="hidden justify-center md:flex">
                      {rA != null ? (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${pctChipClass(rA)}`}
                        >
                          P{rA}
                        </span>
                      ) : (
                        <span className="text-[10px] text-border">—</span>
                      )}
                    </div>

                    {/* A Value */}
                    <span
                      className={`text-right tabular-nums ${
                        winner === 1 ? 'font-extrabold text-primary' : 'text-muted'
                      }`}
                    >
                      {formatMetricVal(m, A, viewMode)}
                    </span>

                    {/* A Bar */}
                    <div
                      className="hidden h-2.5 overflow-hidden rounded-full bg-bg-secondary md:block"
                      aria-hidden
                    >
                      <div
                        className="ml-auto h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${((va ?? 0) / mx) * 100}%`,
                          background: colorA,
                          opacity: winner === 2 ? 0.35 : 1,
                        }}
                      />
                    </div>

                    {/* Label + Delta */}
                    <div className="text-center">
                      <span className="font-semibold text-primary">{label}</span>
                      <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-muted">
                        {m.lowerBetter && <span>{tx('Lower better', 'น้อยยิ่งดี')}</span>}
                        {diff != null && Math.abs(diff) >= 0.005 && (
                          <span className="tabular-nums font-semibold">
                            Δ {formatDelta(m, Math.abs(diff), viewMode).replace('+', '')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* B Bar */}
                    <div
                      className="hidden h-2.5 overflow-hidden rounded-full bg-bg-secondary md:block"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${((vb ?? 0) / mx) * 100}%`,
                          background: colorB,
                          opacity: winner === 1 ? 0.35 : 1,
                        }}
                      />
                    </div>

                    {/* B Value */}
                    <span
                      className={`tabular-nums ${
                        winner === 2 ? 'font-extrabold text-primary' : 'text-muted'
                      }`}
                    >
                      {formatMetricVal(m, B, viewMode)}
                    </span>

                    {/* B Percentile */}
                    <div className="hidden justify-center md:flex">
                      {rB != null ? (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${pctChipClass(rB)}`}
                        >
                          P{rB}
                        </span>
                      ) : (
                        <span className="text-[10px] text-border">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted">
          {tx(
            'Source: fbref (Premier League only). Per-90 figures are normalized by exact minutes played; bars share a single scale per row.',
            'ที่มา: fbref (เฉพาะพรีเมียร์ลีก) ค่าต่อ 90 นาทีคำนวณจากนาทีที่ลงเล่นจริง แถบแต่ละแถวใช้สเกลเดียวกัน',
          )}
        </p>
      </section>

      {/* ----------------------------------- Multi-Season Trajectory */}
      <div className="mt-6">
        <CareerTrajectory
          A={A}
          B={B}
          seasonA={seasonA}
          seasonB={seasonB}
          seasons={seasons}
          seasonsCache={seasonsCache}
          loadingAll={loadingAll}
          clubs={clubMap}
          colorA={colorA}
          colorB={colorB}
          th={th}
          onSelectSeasonPoint={(slot, s, k) => {
            if (slot === 'A') {
              setSeasonA(s);
              setKeyA(k);
            } else {
              setSeasonB(s);
              setKeyB(k);
            }
          }}
        />
      </div>

      {/* ------------------------------------ Similar Players Finder */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="border-b border-border pb-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Users size={13} />
            {tx('Statistical Twins · Same Position', 'ค้นหานักเตะสไตล์ใกล้เคียงในตำแหน่งเดียวกัน')}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-bold text-primary sm:text-xl">
            {tx('Most Similar Players', 'นักเตะที่มีโปรไฟล์คล้ายกันที่สุด')}
          </h2>
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2 md:divide-x md:divide-border">
          {[
            {
              target: A,
              targetSeason: seasonA,
              color: colorA,
              matches: similarA,
              compareSlot: 'B' as const,
            },
            {
              target: B,
              targetSeason: seasonB,
              color: colorB,
              matches: similarB,
              compareSlot: 'A' as const,
            },
          ].map(({ target, targetSeason, color, matches, compareSlot }, idx) => (
            <div key={`${idx}-${target.key}-${targetSeason}`} className="min-w-0 md:px-4 first:md:pl-0 last:md:pr-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <span className="truncate">
                    {tx(`Similar to ${target.name}`, `คล้ายกับ ${target.name}`)}
                  </span>
                </div>
                <span className="text-[11px] text-muted">
                  PL {seasonShort(targetSeason)} · {th ? POS_LABELS[target.pos].th : target.pos}
                </span>
              </div>

              <div className="divide-y divide-border/70 rounded-xl border border-border">
                {matches.map(({ player, similarity }) => (
                  <div
                    key={player.key}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ClubCrest slug={player.club} size={18} />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-primary">{player.name}</p>
                        <p className="truncate text-[11px] text-muted tabular-nums">
                          {clubName(player.club)} · {player.gls}G {player.ast}A · {player.min}&apos;
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md bg-bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                        {fmt(similarity, 2)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (compareSlot === 'B') {
                            setSeasonB(targetSeason);
                            setKeyB(player.key);
                          } else {
                            setSeasonA(targetSeason);
                            setKeyA(player.key);
                          }
                        }}
                        className="rounded-lg border border-border bg-bg-secondary px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
                      >
                        {tx('Compare', 'เทียบ')}
                      </button>
                    </div>
                  </div>
                ))}
                {!matches.length && (
                  <p className="px-3 py-4 text-center text-xs text-muted">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

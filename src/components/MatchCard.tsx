'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/i18n/I18nContext';
import { useClubOptional } from '@/components/ClubProvider';
import { fmt } from '@/lib/format';
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceDot, CartesianGrid,
} from 'recharts';
import type { MatchDetailData, MatchRow } from '@/lib/types';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/* ---------------------------------------------------------- data loading */
export const MATCH_FAILED = Symbol('match_failed');
type Load = MatchDetailData | typeof MATCH_FAILED;
const matchCache = new Map<string, Promise<Load>>();

export function loadMatch(mid: string): Promise<Load> {
  let p = matchCache.get(mid);
  if (!p) {
    p = fetch(`${BASE_PATH}/data/match/${mid}.json`)
      .then(async (r): Promise<Load> => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as MatchDetailData;
      })
      .catch((): Load => {
        matchCache.delete(mid);
        return MATCH_FAILED;
      });
    matchCache.set(mid, p);
  }
  return p;
}

/* ------------------------------------------------------------- helpers */
function Crest({ slug, size = 18 }: { slug: string | null; size?: number }) {
  if (!slug) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-bg-secondary text-[8px] font-bold text-muted"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={`${BASE_PATH}/logos/${slug}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      loading="lazy"
      className="inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

const EV_ICON: Record<string, string> = {
  goal: '⚽', pen_goal: '⚽', own_goal: '⚽', pen_miss: '❌',
  yellow: '🟨', second_yellow: '🟨', red: '🟥', sub: '🔁',
};
const EV_BADGE: Record<string, string> = {
  goal: '', pen_goal: ' (P)', own_goal: ' (OG)', pen_miss: '',
  yellow: '', second_yellow: '', red: '',
};

/* ---------------------------------------------------------------- tabs */
function FactsTab({ d }: { d: MatchDetailData }) {
  const { t } = useI18n();
  const evs = [...d.events].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return (
    <div className="mx-auto max-w-lg py-2">
      <div className="grid grid-cols-[1fr_3.5rem_1fr] items-center text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span>{d.home.name}</span>
        <span />
        <span className="text-right">{d.away.name}</span>
      </div>
      <div className="relative mt-2">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
        <ul className="flex flex-col gap-3">
          <li className="grid grid-cols-[1fr_3.5rem_1fr] items-center text-[10px] font-semibold text-muted">
            <span /><span className="text-center">{t('match.ko')}</span><span />
          </li>
          {evs.map((e, i) => {
            const home = e.side === 'home';
            const label = e.type === 'sub'
              ? `${e.playerIn} → ${e.playerOut}`
              : `${e.player}${e.assist ? ` (${e.assist})` : ''}${EV_BADGE[e.type] ?? ''}`;
            return (
              <li key={i} className="grid grid-cols-[1fr_3.5rem_1fr] items-center gap-x-1">
                <span className={`text-xs ${home ? 'text-right font-medium text-primary' : 'text-muted'}`}>
                  {home ? `${label} ` : ''}
                  {home && <span className="ml-1">{EV_ICON[e.type]}</span>}
                </span>
                <span className="flex flex-col items-center text-[10px] tabular-nums text-muted">
                  <span className="font-semibold text-primary">{e.minute}’</span>
                  {e.score && <span>{e.score}</span>}
                </span>
                <span className={`text-xs ${!home ? 'font-medium text-primary' : 'text-muted'}`}>
                  {!home && <span className="mr-1">{EV_ICON[e.type]}</span>}
                  {!home ? ` ${label}` : ''}
                </span>
              </li>
            );
          })}
          <li className="grid grid-cols-[1fr_3.5rem_1fr] items-center text-[10px] font-semibold text-muted">
            <span /><span className="text-center">{t('match.ft')}</span><span />
          </li>
        </ul>
      </div>
    </div>
  );
}

function Pitch({ d }: { d: MatchDetailData }) {
  const { t } = useI18n();
  const render = (side: 'home' | 'away') => {
    const lu = d.lineups[side];
    const evs = d.events.filter((e) => e.side === side);
    const dots = (d.pitch?.[side] ?? []) as { name: string; number: string; top: number | null; left: number | null; right: number | null }[];
    const pos = new Map(dots.map((p) => [p.name, p]));
    const subs = new Map(evs.filter((e) => e.type === 'sub').map((e) => [e.playerOut, e.playerIn]));
    const cards = new Map(evs.filter((e) => ['yellow', 'second_yellow', 'red'].includes(e.type)).map((e) => [e.player, e.type]));
    const scorers = new Map(evs.filter((e) => ['goal', 'pen_goal', 'own_goal'].includes(e.type)).map((e) => [e.player, true]));
    const flip = side === 'home';
    return (
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px]">
        <svg viewBox="0 0 60 80" className="absolute inset-0 h-full w-full rounded-lg border border-border bg-[#1a7a4a]/90" aria-hidden>
          <rect x="6" y="6" width="48" height="68" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          <line x1="6" y1="40" x2="54" y2="40" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          <circle cx="30" cy="40" r="6" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          <rect x="18" y="6" width="24" height="10" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          <rect x="18" y="64" width="24" height="10" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
        </svg>
        {lu.xi.map((p) => {
          const dot = pos.get(p.name);
          const top = dot?.top ?? 50;
          const x = dot ? (dot.left ?? (dot.right != null ? 100 - dot.right : 50)) : 50;
          return (
            <div
              key={p.name}
              className="absolute flex w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ top: `${top}%`, left: `${flip ? x : 100 - x}%` }}
              title={`${p.number} ${p.name}`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-gray-900 shadow">
                {p.number}
              </span>
              <span className="mt-0.5 max-w-16 truncate text-center text-[8px] font-semibold leading-tight text-white drop-shadow">
                {p.name.split(' ').pop()}
                {scorers.get(p.name) ? ' ⚽' : ''}
                {cards.get(p.name) === 'yellow' ? ' 🟨' : ''}
                {cards.get(p.name) === 'red' || cards.get(p.name) === 'second_yellow' ? ' 🟥' : ''}
                {subs.get(p.name) ? ` ↓${evs.find((e) => e.playerOut === p.name)?.minute}’` : ''}
              </span>
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-4 py-2 sm:flex-row sm:gap-6">
      {(['home', 'away'] as const).map((side) => (
        <div key={side} className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-primary">
            <Crest slug={d[side].slug} /> {d[side].name}
            <span className="text-muted">({d[side].formation ?? '—'})</span>
          </div>
          {render(side)}
          <div className="mt-2 text-center text-xs text-muted">
            {t('match.manager')}: {d[side].manager ?? '—'}
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-muted">
            {d.lineups[side].bench.map((p) => (
              <li key={p.name} className="flex justify-center gap-2">
                <span className="tabular-nums text-muted">{p.number}</span>
                <span className="truncate">{p.name}</span>
                {p.subInMin && <span className="text-brand">↑{p.subInMin}’</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const STAT_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'top', keys: ['possession', 'xg', 'shots', 'sot', 'corners'] },
  { title: 'shots', keys: ['shots', 'sot', 'saves', 'offsides', 'deep'] },
  { title: 'defence', keys: ['tackles', 'interceptions', 'clearances', 'crosses', 'aerials', 'touches', 'ppda'] },
  { title: 'discipline', keys: ['fouls', 'yellow', 'red'] },
];

function StatBar({ label, h, a, dec = 0, pct = false }: {
  label: string; h: number | null; a: number | null; dec?: number; pct?: boolean;
}) {
  const tot = (h ?? 0) + (a ?? 0);
  const share = tot > 0 ? ((h ?? 0) / tot) * 100 : 50;
  const show = (v: number | null) =>
    v == null ? '—' : dec ? fmt(v, dec) : Number.isInteger(v) ? `${v}${pct ? '%' : ''}` : fmt(v);
  return (
    <div>
      <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center text-xs tabular-nums">
        <span className="font-semibold text-primary">{show(h)}</span>
        <span className="truncate text-center text-muted">{label}</span>
        <span className="text-right font-semibold text-primary">{show(a)}</span>
      </div>
      <div className="mt-0.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <span className="rounded-l-full bg-brand" style={{ width: `${share}%` }} />
        <span className="flex-1 rounded-r-full bg-muted/30" />
      </div>
    </div>
  );
}

function StatsTab({ d }: { d: MatchDetailData }) {
  const { t } = useI18n();
  const ts = d.teamStats;
  const get = (k: string): [number | null, number | null] => {
    const v = (ts as Record<string, { home: number | string | null; away: number | string | null } | null>)[k];
    if (!v) return [null, null];
    const n = (x: number | string | null) => {
      if (x == null) return null;
      const m = String(x).match(/-?\d+(?:\.\d+)?/);
      return m ? parseFloat(m[0]) : null;
    };
    return [n(v.home), n(v.away)];
  };
  const label = (k: string) => t(`match.stat.${k}`) || k;
  return (
    <div className="flex flex-col gap-5 py-2">
      {STAT_GROUPS.map(({ title, keys }) => {
        const rows = keys.filter((k) => {
          const [h, a] = get(k);
          return h != null || a != null;
        });
        if (!rows.length) return null;
        return (
          <div key={title}>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t(`match.group.${title}`)}
            </h4>
            <div className="flex flex-col gap-2.5">
              {rows.map((k) => {
                const [h, a] = get(k);
                return (
                  <StatBar key={k} label={label(k)} h={h} a={a}
                    dec={k === 'xg' || k === 'ppda' ? 2 : 0}
                    pct={k === 'possession'} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShotMapTab({ d }: { d: MatchDetailData }) {
  const { t } = useI18n();
  const shots = d.shots ?? [];
  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="relative mx-auto aspect-[3/2] w-full max-w-xl">
        <svg viewBox="0 0 100 68" className="h-full w-full rounded-lg border border-border bg-[#1a7a4a]/90" aria-hidden>
          <rect x="4" y="4" width="92" height="60" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          <line x1="50" y1="4" x2="50" y2="64" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          <circle cx="50" cy="34" r="7" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          <rect x="4" y="18" width="12" height="32" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          <rect x="84" y="18" width="12" height="32" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".6" />
          {shots.map((s, i) => {
            const r = 1.2 + s.xg * 8;
            const goal = s.result === 'Goal' || s.result === 'OwnGoal';
            return (
              <circle
                key={i}
                cx={(1 - s.x) * 92 + 4}
                cy={s.y * 60 + 4}
                r={r}
                className={s.side === 'home' ? 'fill-sky-300' : 'fill-orange-300'}
                fillOpacity={goal ? 0.95 : 0.35}
                stroke={goal ? '#fff' : 'none'}
                strokeWidth={goal ? 0.6 : 0}
              >
                <title>{`${s.minute}' ${s.player} — xG ${fmt(s.xg)} ${s.shotType ?? ''} (${s.situation})`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-center gap-4 text-[11px] text-muted">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-300" />{d.home.name}</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-300" />{d.away.name}</span>
          <span>{t('match.shotSize')}</span>
        </div>
      </div>
      {d.xgFlow && (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.xgFlow} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="minute" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}’`} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={((v: unknown, name: unknown) => [fmt(Number(v)), name === 'home' ? d.home.name : d.away.name]) as never}
                labelFormatter={(v) => `${v}’`}
              />
              <Line type="stepAfter" dataKey="home" stroke="#7dd3fc" dot={false} strokeWidth={2} />
              <Line type="stepAfter" dataKey="away" stroke="#fdba74" dot={false} strokeWidth={2} />
              {(d.xgFlow || []).filter((p) => p.goal).map((p, i) => (
                <ReferenceDot key={i} x={p.minute} y={p[p.side as 'home' | 'away']} r={4}
                  fill={p.side === 'home' ? '#0ea5e9' : '#ea580c'} stroke="#fff" />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-center text-[11px] text-muted">{t('match.xgFlow')}</p>
        </div>
      )}
    </div>
  );
}

function PlayersTab({ d }: { d: MatchDetailData }) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<string>('minutes');
  const [dir, setDir] = useState(-1);
  const render = (side: 'home' | 'away') => {
    const ps = d.playerStats?.[side];
    if (!ps) return null;
    const cols = ps.columns.filter((c) => c.stat !== 'nationality' && c.stat !== 'age');
    const rows = [...ps.rows].sort((x, y) => {
      const xv = parseFloat(x[sortKey]) || 0;
      const yv = parseFloat(y[sortKey]) || 0;
      return (yv - xv) * dir * -1;
    });
    return (
      <div key={side} className="min-w-0">
        <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
          <Crest slug={d[side].slug} size={14} /> {d[side].name}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
                {cols.map((c) => (
                  <th key={c.stat}
                    className="cursor-pointer px-1.5 py-1 font-semibold hover:text-primary"
                    onClick={() => { setDir(sortKey === c.stat ? -dir : -1); setSortKey(c.stat); }}>
                    {c.label || c.stat}
                    {sortKey === c.stat ? (dir === -1 ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border-light">
                  {cols.map((c) => {
                    const v = r[c.stat];
                    const n = parseFloat(v);
                    return (
                      <td key={c.stat} className={`px-1.5 py-1 ${c.stat === 'player' ? 'font-medium text-primary' : 'text-secondary'}`}>
                        {v === '' || v == null ? '—'
                          : c.stat === 'player' ? v
                          : !Number.isNaN(n) && !Number.isInteger(n) ? fmt(n) : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  return <div className="flex flex-col gap-6 py-2">{render('home')}{render('away')}</div>;
}

function H2HTab({ d, onOpen }: { d: MatchDetailData; onOpen: (mid: string) => void }) {
  const { t } = useI18n();
  const ctx = useClubOptional();
  const nameOf = (slug: string | null) =>
    ctx?.clubs.find((c) => c.slug === slug)?.name ?? slug ?? '?';
  if (!d.h2h?.length) return <p className="py-4 text-sm text-muted">{t('match.noH2h')}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border-light py-2">
      {d.h2h.map((h, i) => (
        <li key={i}>
          <button
            type="button"
            disabled={!h.matchId}
            onClick={() => h.matchId && onOpen(h.matchId)}
            className="flex w-full items-center gap-3 px-2 py-2 text-left text-sm hover:bg-bg-secondary disabled:opacity-60"
          >
            <span className="w-20 text-xs tabular-nums text-muted">{h.date}</span>
            <Crest slug={h.home} size={14} />
            <span className="min-w-0 flex-1 truncate text-primary">
              {nameOf(h.home)} {h.gf}–{h.ga} {nameOf(h.home === d.home.slug ? d.away.slug : d.home.slug)}
            </span>
            <span className="text-[10px] text-muted">{h.competition}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- card */
const TABS = ['facts', 'lineups', 'stats', 'shots', 'players', 'h2h'] as const;
type Tab = (typeof TABS)[number];

export function MatchCard({
  mid, rows, index, onNavigate, onClose,
}: {
  mid: string;
  rows: MatchRow[];
  index: number;
  onNavigate: (idx: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<MatchDetailData | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('facts');
  const cardRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    let live = true;
    loadMatch(mid).then((r) => {
      if (!live) return;
      if (r === MATCH_FAILED) setFailed(true);
      else setData(r);
    });
    return () => { live = false; };
  }, [mid]);

  // focus trap + esc
  useEffect(() => {
    lastFocus.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    const el = cardRef.current;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && el) {
        const f = el.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey, true);
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const d = data;
  const row = rows[index];
  const hasShots = !!(d?.shots?.length);
  const tabs = TABS.filter((tb) => tb !== 'shots' || hasShots || !d);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('match.title')}
        tabIndex={-1}
        className="matchcard-in flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-bg-primary shadow-2xl outline-none sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl"
      >
        {/* header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className="min-w-0 truncate">
              {d?.competition ?? row?.competition}
              {(d?.round ?? row?.round) ? ` · ${d?.round ?? row?.round}` : ''}
              {' · '}{d?.date ?? row?.date}{d?.kickoff ? ` ${d.kickoff}` : row?.time ? ` ${row.time}` : ''}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <button type="button" aria-label={t('match.prev')}
                disabled={index <= 0} onClick={() => onNavigate(index - 1)}
                className="rounded p-1 text-muted hover:bg-bg-secondary disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button type="button" aria-label={t('match.next')}
                disabled={index < 0 || index >= rows.length - 1} onClick={() => onNavigate(index + 1)}
                className="rounded p-1 text-muted hover:bg-bg-secondary disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
              <button type="button" aria-label={t('match.close')} onClick={onClose}
                className="rounded p-1 text-muted hover:bg-bg-secondary">
                <X size={16} />
              </button>
            </span>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex items-center justify-end gap-2 text-right">
              <div>
                <div className="text-sm font-semibold text-primary sm:text-base">{d?.home.name ?? '…'}</div>
                <Scorers d={d} side="home" />
              </div>
              <Crest slug={d?.home.slug ?? null} size={28} />
            </div>
            <div className="px-2 text-center font-display text-2xl font-bold tabular-nums text-primary">
              {d ? `${d.home.score ?? '–'} – ${d.away.score ?? '–'}` : row ? `${row.gf}–${row.ga}` : '…'}
              {d?.home.pens != null && (
                <span className="block text-xs font-normal text-muted">
                  ({d.home.pens}–{d.away.pens} {t('match.pens')})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Crest slug={d?.away.slug ?? null} size={28} />
              <div>
                <div className="text-sm font-semibold text-primary sm:text-base">{d?.away.name ?? '…'}</div>
                <Scorers d={d} side="away" />
              </div>
            </div>
          </div>
          <div className="mt-1 text-center text-[11px] text-muted">
            {[d?.venue, d?.attendance && `${t('match.att')}: ${d.attendance}`,
              d?.referee && `${t('match.ref')}: ${d.referee}`].filter(Boolean).join(' · ')}
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-1.5" role="tablist">
          {tabs.map((tb) => (
            <button
              key={tb} role="tab" aria-selected={tab === tb}
              onClick={() => setTab(tb)}
              className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                tab === tb ? 'bg-brand text-white' : 'text-muted hover:bg-bg-secondary'
              }`}
            >
              {t(`match.tab.${tb}`)}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {!d && !failed && (
            <div className="animate-pulse py-6">
              <div className="mx-auto h-4 w-40 rounded bg-bg-secondary" />
              <div className="mt-4 space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-3 rounded bg-bg-secondary" style={{ width: `${90 - i * 6}%` }} />
                ))}
              </div>
            </div>
          )}
          {failed && (
            <div className="py-8 text-center text-sm text-muted">
              {t('matchLog.loadFail')}
              <button type="button" onClick={() => { setFailed(false); loadMatch(mid).then((r) => r === MATCH_FAILED ? setFailed(true) : setData(r)); }}
                className="ml-2 rounded bg-brand px-3 py-1 text-xs font-medium text-white">
                {t('matchLog.retry')}
              </button>
            </div>
          )}
          {d && tab === 'facts' && <FactsTab d={d} />}
          {d && tab === 'lineups' && <Pitch d={d} />}
          {d && tab === 'stats' && <StatsTab d={d} />}
          {d && tab === 'shots' && <ShotMapTab d={d} />}
          {d && tab === 'players' && <PlayersTab d={d} />}
          {d && tab === 'h2h' && <H2HTab d={d} onOpen={(m2) => { const i = rows.findIndex((r) => r.matchId === m2); if (i >= 0) onNavigate(i); }} />}
        </div>

        {/* footer */}
        {d?.reportUrl && (
          <div className="border-t border-border px-4 py-2 text-right">
            <a href={d.reportUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              {t('matchLog.report')} <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Scorers({ d, side }: { d: MatchDetailData | null; side: 'home' | 'away' }) {
  if (!d) return null;
  const evs = d.events.filter((e) => e.side === side && ['goal', 'pen_goal', 'own_goal', 'red', 'second_yellow'].includes(e.type));
  if (!evs.length) return <div className="h-3" />;
  return (
    <div className="text-[10px] leading-tight text-muted">
      {evs.map((e, i) => (
        <div key={i}>
          {e.type === 'red' || e.type === 'second_yellow' ? '🟥' : '⚽'} {e.player} {e.minute}’{e.type === 'pen_goal' ? ' (P)' : e.type === 'own_goal' ? ' (OG)' : ''}
        </div>
      ))}
    </div>
  );
}

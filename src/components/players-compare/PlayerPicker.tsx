'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { ClubIndexEntry } from '@/lib/types';
import { seasonShort } from '@/lib/stats';
import { POS_LABELS, type DemoPlayer, type PosCode } from './types';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function ClubCrest({ slug, size = 18 }: { slug: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE_PATH}/logos/${slug}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      className="shrink-0 object-contain"
    />
  );
}

const POS_FILTERS: ('ALL' | PosCode)[] = ['ALL', 'FW', 'MF', 'DF'];

export function PlayerPicker({
  sideLabel,
  color,
  player,
  season,
  seasons,
  list,
  clubs,
  th,
  loading,
  onPickPlayer,
  onPickSeason,
}: {
  sideLabel: string;
  color: string;
  player: DemoPlayer | null;
  season: string;
  seasons: string[];
  list: DemoPlayer[];
  clubs: Map<string, ClubIndexEntry>;
  th: boolean;
  loading: boolean;
  onPickPlayer: (p: DemoPlayer) => void;
  onPickSeason: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [posFilter, setPosFilter] = useState<'ALL' | PosCode>('ALL');
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    let base = posFilter === 'ALL' ? list : list.filter((p) => p.pos === posFilter);
    if (nq) {
      base = base.filter((p) => {
        const c = clubs.get(p.club);
        return (
          norm(p.name).includes(nq) ||
          norm(c?.name ?? '').includes(nq) ||
          norm(c?.nameTh ?? '').includes(nq) ||
          norm(c?.shortName ?? '').includes(nq)
        );
      });
    }
    return base.slice(0, 70);
  }, [q, posFilter, list, clubs]);

  const activeClub = player ? clubs.get(player.club) : undefined;

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          <span
            className="h-2.5 w-2.5 rounded-full ring-2 ring-surface"
            style={{ background: color }}
          />
          <span>{sideLabel}</span>
        </div>
        <div className="relative flex items-center">
          <select
            value={season}
            onChange={(e) => onPickSeason(e.target.value)}
            aria-label={`${sideLabel} ${th ? 'ฤดูกาล' : 'Season'}`}
            className="cursor-pointer appearance-none rounded-lg border border-border bg-bg-secondary py-1 pl-2.5 pr-7 text-xs font-bold tabular-nums text-primary transition-colors hover:border-primary/40 focus:border-brand focus:outline-none"
          >
            {[...seasons].reverse().map((s) => (
              <option key={s} value={s}>
                PL {seasonShort(s)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="pointer-events-none absolute right-2 text-muted"
          />
        </div>
      </div>

      {/* Main Trigger / Search Field */}
      <div
        className="flex items-center gap-2.5 rounded-xl border bg-surface px-3 py-2.5 transition-all focus-within:ring-2"
        style={{
          borderColor: open ? color : undefined,
          boxShadow: open ? `0 0 0 1px ${color}` : undefined,
        }}
      >
        {player && !open ? (
          <ClubCrest slug={player.club} size={22} />
        ) : (
          <Search size={16} className="shrink-0 text-muted" />
        )}

        <input
          ref={inputRef}
          value={open ? q : player?.name ?? ''}
          placeholder={
            open
              ? th
                ? 'ค้นหาชื่อนักเตะหรือสโมสร...'
                : 'Search player or club...'
              : player?.name ?? '—'
          }
          onFocus={() => {
            setOpen(true);
            setQ('');
          }}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-primary outline-none placeholder:font-normal placeholder:text-muted"
          aria-label={sideLabel}
        />

        {open && q ? (
          <button
            type="button"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
            className="rounded-full p-0.5 text-muted hover:bg-bg-secondary hover:text-primary"
            aria-label={th ? 'ล้างคำค้นหา' : 'Clear search'}
          >
            <X size={14} />
          </button>
        ) : (
          player &&
          !open && (
            <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted sm:flex">
              <span className="truncate max-w-[96px]">
                {th ? activeClub?.nameTh ?? activeClub?.name : activeClub?.shortName ?? activeClub?.name}
              </span>
              <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {player.pos}
              </span>
            </span>
          )
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-bg-secondary/60 px-3 py-2">
            <div className="flex items-center gap-1">
              {POS_FILTERS.map((pf) => (
                <button
                  key={pf}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setPosFilter(pf)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors ${
                    posFilter === pf
                      ? 'text-white'
                      : 'text-muted hover:bg-surface hover:text-primary'
                  }`}
                  style={posFilter === pf ? { background: color } : undefined}
                >
                  {pf === 'ALL'
                    ? th
                      ? 'ทั้งหมด'
                      : 'ALL'
                    : th
                    ? POS_LABELS[pf].th
                    : pf}
                </button>
              ))}
            </div>
            <span className="text-[11px] tabular-nums text-muted">
              {loading
                ? th
                  ? 'กำลังโหลด...'
                  : 'Loading...'
                : `${filtered.length} ${th ? 'รายการ' : 'shown'}`}
            </span>
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.map((p) => {
              const c = clubs.get(p.club);
              const selected = p.key === player?.key;
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onPickPlayer(p);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-bg-secondary ${
                      selected ? 'bg-bg-secondary/80' : ''
                    }`}
                  >
                    <ClubCrest slug={p.club} size={18} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-primary">
                          {p.name}
                        </span>
                        {!p.eligible && (
                          <span className="rounded bg-warning-soft px-1 py-0.2 text-[9px] font-bold text-warning">
                            {th ? 'น้อย' : '<30%'}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted">
                        {th ? c?.nameTh ?? c?.name : c?.name} · {p.posRaw}
                        {p.age != null ? ` · ${p.age}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <div className="text-xs font-bold text-primary">
                        {p.gls}G {p.ast}A
                      </div>
                      <div className="text-[10px] text-muted">{p.min}&apos;</div>
                    </div>
                  </button>
                </li>
              );
            })}
            {!filtered.length && (
              <li className="px-4 py-6 text-center text-xs text-muted">
                {th ? 'ไม่พบนักเตะที่ตรงกับคำค้นหา' : 'No matching players in this season.'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

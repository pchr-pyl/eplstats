'use client';

import { useI18n } from '@/i18n/I18nContext';
import type { MatchRow, CompGroup, MatchlogTable, SeasonMatchlogs } from '@/lib/types';
import { compInGroup, canonicalComp } from '@/lib/stats';
import { fmt, dash } from '@/lib/format';

export const COMP_SHORT: Record<string, string> = {
  'Premier League': 'PL',
  'FA Cup': 'FA',
  'EFL Cup': 'EFL',
  'Champions League': 'UCL',
  'Europa League': 'UEL',
  'Conference League': 'UECL',
  'Community Shield': 'CS',
  'UEFA Super Cup': 'SC',
  'Club World Cup': 'CWC',
  'International Champions Cup': 'ICC',
};

export const RESULT_STYLE: Record<string, string> = {
  W: 'bg-success/15 text-success',
  D: 'bg-bg-secondary text-muted',
  L: 'bg-danger/15 text-danger',
};

const matchlogCache = new Map<string, Promise<SeasonMatchlogs>>();

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function loadMatchlogs(season: string): Promise<SeasonMatchlogs> {
  let p = matchlogCache.get(season);
  if (!p) {
    p = fetch(`${BASE_PATH}/data/matchlogs-${season}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<SeasonMatchlogs>) : {}))
      .catch(() => ({}));
    matchlogCache.set(season, p);
  }
  return p;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
}

export function scoreText(m: MatchRow): string {
  if (m.gf == null || m.ga == null) return '—';
  let s = `${m.gf}–${m.ga}`;
  if (m.gfPens != null && m.gaPens != null) s += ` (${m.gfPens}–${m.gaPens} p)`;
  return s;
}

export function SideToggle({
  side,
  onChange,
}: {
  side: 'for' | 'against';
  onChange: (s: 'for' | 'against') => void;
}) {
  const { t } = useI18n();
  return (
    <span className="ml-auto flex shrink-0 gap-1 rounded-full bg-bg-secondary p-0.5">
      {(['for', 'against'] as const).map((s) => {
        const active = s === side;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={active}
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
              active ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-primary'
            }`}
          >
            {t(`matchLog.side.${s}`)}
          </button>
        );
      })}
    </span>
  );
}

export function StatTable({ table, group }: { table: MatchlogTable; group: CompGroup }) {
  const { t } = useI18n();
  const cols = table.columns;
  const compIdx = cols.indexOf('Comp');
  const oppIdx = cols.indexOf('Opponent');
  const endIdx = cols[cols.length - 1] === 'Match Report' ? cols.length - 1 : cols.length;
  const view = cols.slice(0, endIdx);
  const rows = table.rows.filter(
    (r) => compIdx < 0 || compInGroup(r[compIdx] ?? '', group),
  );

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">{t('matchLog.noStatData')}</p>;
  }

  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-elevated">
          <tr>
            {view.map((c, i) => (
              <th
                key={`${c}-${i}`}
                className={`whitespace-nowrap border-b border-border px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted ${
                  i > oppIdx ? 'text-right' : 'text-left'
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-border transition-colors hover:bg-bg-secondary">
              {view.map((c, ci) => {
                const v = r[ci] ?? '';
                if (c === 'Date') {
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2 text-xs tabular-nums text-muted">
                      {formatDate(v)}
                    </td>
                  );
                }
                if (c === 'Comp') {
                  return (
                    <td key={ci} className="px-2.5 py-2">
                      <span className="rounded bg-bg-secondary px-1 py-0.5 text-[10px] font-semibold text-muted">
                        {COMP_SHORT[canonicalComp(v)] ?? v}
                      </span>
                    </td>
                  );
                }
                if (c === 'Result') {
                  return (
                    <td key={ci} className="px-2.5 py-2">
                      <span
                        className={`rounded px-1 py-0.5 text-xs font-bold ${
                          RESULT_STYLE[v] ?? 'bg-bg-secondary text-muted'
                        }`}
                      >
                        {v || '—'}
                      </span>
                    </td>
                  );
                }
                if (c === 'Opponent') {
                  return (
                    <td key={ci} className="whitespace-nowrap px-2.5 py-2 text-xs font-medium text-primary">
                      {dash(v)}
                    </td>
                  );
                }
                return (
                  <td
                    key={ci}
                    className={`whitespace-nowrap px-2.5 py-2 text-xs tabular-nums ${
                      ci > oppIdx ? 'text-right text-secondary' : 'text-left text-muted'
                    }`}
                  >
                    {v || '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoresList({ rows, showComp }: { rows: MatchRow[]; showComp: boolean }) {
  const { t } = useI18n();
  return (
    <ul className="max-h-[560px] divide-y divide-border overflow-y-auto">
      {rows.map((m, i) => {
        const meta = [
          m.round,
          m.venue ? t(`matchLog.venue.${m.venue}`) : null,
          m.possession != null ? `${t('matchLog.poss')} ${fmt(m.possession, 0)}%` : null,
          m.xg != null ? `xG ${fmt(m.xg, 2)}` : null,
          m.xga != null ? `xGA ${fmt(m.xga, 2)}` : null,
          m.formation ? `${t('matchLog.form')} ${m.formation}` : null,
          m.attendance != null ? `${t('matchLog.att')} ${m.attendance.toLocaleString()}` : null,
          m.referee,
          m.notes,
        ].filter(Boolean);

        return (
          <li key={`${m.date}-${i}`} className="px-4 py-2.5 transition-colors hover:bg-bg-secondary">
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs tabular-nums text-muted">
                {formatDate(m.date)}
              </span>
              {showComp && (
                <span className="w-10 shrink-0 rounded bg-bg-secondary px-1 py-0.5 text-center text-[10px] font-semibold text-muted">
                  {COMP_SHORT[m.competition] ?? m.competition}
                </span>
              )}
              <span
                className={`w-7 shrink-0 rounded px-1 py-0.5 text-center text-xs font-bold ${
                  RESULT_STYLE[m.result ?? ''] ?? 'bg-bg-secondary text-muted'
                }`}
              >
                {m.result ?? '—'}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                {dash(m.opponent)}
              </span>
              <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-primary">
                {scoreText(m)}
              </span>
            </div>
            {meta.length > 0 && (
              <div className="mt-1 truncate pl-16 text-xs text-muted sm:pl-[7.5rem]">
                {meta.join(' · ')}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

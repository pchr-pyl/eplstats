import { getLeague, getMatches, getTeamStats } from './data';

export interface QuadrantClub {
  slug: string; mp: number; xg: number | null; xga: number | null; gf: number;
  ppg: number; clean: number; home: number | null; away: number | null;
  homeMp: number; awayMp: number; shots: number | null; accuracy: number | null;
  xgMp: number; xgGf: number | null; xgPpg: number | null; xgClean: number | null;
}

export function getQuadrantData(): Record<string, QuadrantClub[]> {
  return Object.fromEntries(Object.entries(getLeague()).map(([season, table]) => [season, table.filter(r => r.mp > 0).map(r => {
    const matches = getMatches(r.slug).filter(m => m.season === season && m.competition === 'Premier League' && (m.result === 'W' || m.result === 'D' || m.result === 'L'));
    const split = (venue: string) => {
      const ms = matches.filter(m => m.venue === venue);
      return { mp: ms.length, ppg: ms.length ? ms.reduce((n, m) => n + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0), 0) / ms.length : null };
    };
    const home = split('Home'), away = split('Away');
    const xgMatches = matches.filter(m => m.xg != null && m.xga != null && m.gf != null && m.ga != null);
    const xgMp = xgMatches.length;
    const stats = getTeamStats(r.slug)[season]?.['Premier League'];
    const shotsComplete = stats && stats.shN === r.mp && stats.sh != null && stats.sot != null;
    return { slug: r.slug, mp: r.mp, xg: xgMp ? xgMatches.reduce((n, m) => n + m.xg!, 0) / xgMp : null, xga: xgMp ? xgMatches.reduce((n, m) => n + m.xga!, 0) / xgMp : null,
      xgMp, xgGf: xgMp ? xgMatches.reduce((n, m) => n + m.gf!, 0) / xgMp : null,
      xgPpg: xgMp ? xgMatches.reduce((n, m) => n + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0), 0) / xgMp : null,
      xgClean: xgMp ? xgMatches.filter(m => m.ga === 0).length / xgMp * 100 : null,
      gf: r.gf / r.mp, ppg: r.pts / r.mp, clean: r.cs / r.mp * 100, home: home.ppg, away: away.ppg, homeMp: home.mp, awayMp: away.mp,
      shots: shotsComplete ? stats.sh! / r.mp : null, accuracy: shotsComplete && stats.sh! > 0 ? stats.sot! / stats.sh! * 100 : null };
  })]));
}

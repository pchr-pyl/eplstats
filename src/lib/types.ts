export interface SeasonRow {
  season: string;
  competition: string;
  rank: string | null;
  mp: number | null;
  w: number | null;
  d: number | null;
  l: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  pts: number | null;
  ptsPerMp: number | null;
  xg: number | null;
  xga: number | null;
  xgd: number | null;
  sota: number | null;
  cs: number | null;
  attendance: number | null;
  topScorer: string | null;
  goalkeeper: string | null;
  notes: string | null;
}

export type CompGroup =
  | 'all'
  | 'premier-league'
  | 'fa-cup'
  | 'efl-cup'
  | 'europe';

export interface MatchRow {
  season: string;
  date: string;
  time: string | null;
  competition: string;
  round: string | null;
  venue: string | null;
  result: string | null;
  gf: number | null;
  ga: number | null;
  gfPens: number | null;
  gaPens: number | null;
  opponent: string | null;
  possession: number | null;
  attendance: number | null;
  captain: string | null;
  formation: string | null;
  oppFormation: string | null;
  referee: string | null;
  notes: string | null;
  xg: number | null;
  xga: number | null;
}

export type MatchlogType = 'shooting' | 'keeper' | 'misc';

export interface MatchlogTable {
  columns: string[];
  rows: string[][];
}

export interface MatchlogSides {
  for?: MatchlogTable;
  against?: MatchlogTable;
}

export type SeasonMatchlogs = Partial<Record<MatchlogType, MatchlogSides>>;

export interface AttackSeasonRow {
  mp: number;
  gls: number | null;
  sh: number | null;
  sot: number | null;
  pk: number | null;
  pkatt: number | null;
  shCoverage: number;
}

export type AttackBySeason = Record<string, AttackSeasonRow>;

export interface KeeperMatchRow {
  season: string;
  date: string;
  time: string | null;
  comp: string;
  round: string | null;
  venue: string | null;
  result: string | null;
  gf: number | null;
  ga: number | null;
  gfPens: number | null;
  gaPens: number | null;
  opponent: string | null;
  sota: number | null;
  saves: number | null;
  savePct: number | null;
  cs: number | null;
  pkatt: number | null;
  pka: number | null;
  pksv: number | null;
  pkm: number | null;
}

export interface GkSeasonRow {
  season: string;
  player: string;
  nation: string | null;
  age: number | null;
  mp: number | null;
  starts: number | null;
  min: number | null;
  nineties: number | null;
  ga: number | null;
  ga90: number | null;
  sota: number | null;
  saves: number | null;
  savePct: number | null;
  w: number | null;
  d: number | null;
  l: number | null;
  cs: number | null;
  csPct: number | null;
  pkatt: number | null;
  pka: number | null;
  pksv: number | null;
  pkm: number | null;
  pkSavePct: number | null;
}

export interface PsxgSeasonRow {
  season: string;
  nineties: number | null;
  ga: number | null;
  pka: number | null;
  psxg: number | null;
  psxgPerSot: number | null;
  psxgPlusMinus: number | null;
  psxgPer90: number | null;
  opa: number | null;
  opaPer90: number | null;
  avgDistance: number | null;
  psxgSource?: string | null;
}

export interface PsxgGkRow {
  season: string;
  player: string;
  nation?: string | null;
  age?: number | null;
  mp?: number | null;
  nineties?: number | null;
  ga: number | null;
  sota?: number | null;
  saves?: number | null;
  cs?: number | null;
  psxg: number | null;
  psxgPerSot?: number | null;
  psxgPlusMinus: number | null;
  partial?: boolean | null;
}

export interface KeepersData {
  matchLog: KeeperMatchRow[];
  perGkSeason: GkSeasonRow[];
  psxg: PsxgSeasonRow[];
  psxgPerGk: PsxgGkRow[];
}

export interface SquadPlayer {
  name: string;
  pos: string;
  subPos: string | null;
  age: number | null;
  status: string | null;
  country: string | null;
  weeklyGross: number | null;
  yearlyGross: number | null;
  bonusYearly: number | null;
  weeklyNet: number | null;
  yearlyNet: number | null;
  signed: string | null;
  expires: string | null;
  grossRemaining: number | null;
  onLoan: boolean;
}

export interface SquadSummary {
  grossWeekly: number | null;
  grossYearly: number | null;
  grossTotalYearly: number | null;
  avgTotalYearly: number | null;
  players: number | null;
  withSalary: number | null;
}

export interface SquadSeason {
  summary: SquadSummary;
  players: SquadPlayer[];
}

export interface SquadData {
  updated: string | null;
  source?: string | null;
  players: SquadPlayer[];
  seasons?: Record<string, SquadSeason>;
}

export interface PlayerSeasonStats {
  player: string;
  nation: string | null;
  pos: string;
  age: number | null;
  mp: number | null;
  starts: number | null;
  min: number | null;
  nineties: number | null;
  gls: number | null;
  ast: number | null;
  gPlusA: number | null;
  gMinusPk: number | null;
  pk: number | null;
  pkatt: number | null;
  crdY: number | null;
  crdR: number | null;
  sh: number | null;
  sot: number | null;
  sotPct: number | null;
  gPerSh: number | null;
  gPerSot: number | null;
  minsPerStart: number | null;
  ppm: number | null;
}

export interface PlayersSeason {
  players: PlayerSeasonStats[];
  sourceURL: string | null;
}

export interface PlayersData {
  seasons: Record<string, PlayersSeason>;
  latest: string;
}

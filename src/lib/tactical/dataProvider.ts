import type {
  PlayerRoleGroup,
  RosterPlayer,
  TacticalBootstrapData,
  TacticalClub,
} from './types';

/**
 * Abstract Data Layer interface for Team & Player sources.
 * Implement this interface to connect external APIs (API-Football, Football-Data.org,
 * StatsBomb, Opta, or custom club databases) without modifying tactical board UI/state.
 */
export interface TeamDataProvider {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  listClubs(): Promise<TacticalClub[]>;
  getClubRoster(clubSlug: string): Promise<RosterPlayer[]>;
  searchPlayers(query: string, clubSlug?: string): Promise<RosterPlayer[]>;
}

/**
 * Built-in real Premier League provider backed by the project's scraped & built datasets.
 */
export class EplLocalDataProvider implements TeamDataProvider {
  readonly id = 'epl-local';
  readonly label = 'Premier League Real Dataset';
  readonly description: string;
  private readonly data: TacticalBootstrapData;

  constructor(bootstrap: TacticalBootstrapData) {
    this.data = bootstrap;
    this.description = `Real EPL clubs & rosters (${bootstrap.season} + historical PL clubs, official match shirt numbers where available)`;
  }

  async listClubs(): Promise<TacticalClub[]> {
    return this.data.clubs;
  }

  getClubsSync(): TacticalClub[] {
    return this.data.clubs;
  }

  async getClubRoster(clubSlug: string): Promise<RosterPlayer[]> {
    return this.data.rosters[clubSlug] ?? [];
  }

  getClubRosterSync(clubSlug: string): RosterPlayer[] {
    return this.data.rosters[clubSlug] ?? [];
  }

  async searchPlayers(query: string, clubSlug?: string): Promise<RosterPlayer[]> {
    const q = query.trim().toLowerCase();
    const pool = clubSlug
      ? (this.data.rosters[clubSlug] ?? [])
      : Object.values(this.data.rosters).flat();
    if (!q) return pool;
    return pool.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.shortName.toLowerCase().includes(q) ||
        p.number.includes(q) ||
        p.pos.toLowerCase().includes(q) ||
        (p.subPos?.toLowerCase().includes(q) ?? false),
    );
  }
}

export interface ExternalApiConfig {
  id: string;
  label: string;
  baseUrl: string;
  headers?: Record<string, string>;
  mapClub?: (raw: unknown) => TacticalClub;
  mapPlayer?: (raw: unknown, clubSlug: string) => RosterPlayer;
}

/**
 * Ready-to-use adapter template for plugging in external Football REST APIs in the future.
 */
export class ExternalApiTeamProvider implements TeamDataProvider {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  private readonly cfg: ExternalApiConfig;

  constructor(cfg: ExternalApiConfig) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.label = cfg.label;
    this.description = `External API (${cfg.baseUrl})`;
  }

  async listClubs(): Promise<TacticalClub[]> {
    const res = await fetch(`${this.cfg.baseUrl}/clubs`, {
      headers: this.cfg.headers,
    });
    if (!res.ok) throw new Error(`API clubs failed: ${res.status}`);
    const data = (await res.json()) as unknown[];
    return this.cfg.mapClub ? data.map(this.cfg.mapClub) : (data as TacticalClub[]);
  }

  async getClubRoster(clubSlug: string): Promise<RosterPlayer[]> {
    const res = await fetch(
      `${this.cfg.baseUrl}/clubs/${encodeURIComponent(clubSlug)}/players`,
      { headers: this.cfg.headers },
    );
    if (!res.ok) throw new Error(`API roster failed: ${res.status}`);
    const data = (await res.json()) as unknown[];
    return this.cfg.mapPlayer
      ? data.map((item) => this.cfg.mapPlayer!(item, clubSlug))
      : (data as RosterPlayer[]).map((p) => ({ ...p, source: 'external-api' }));
  }

  async searchPlayers(query: string, clubSlug?: string): Promise<RosterPlayer[]> {
    const roster = clubSlug ? await this.getClubRoster(clubSlug) : [];
    const q = query.trim().toLowerCase();
    return roster.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.number.includes(q) ||
        p.pos.toLowerCase().includes(q),
    );
  }
}

export function createCustomRosterPlayer(input: {
  name: string;
  number: string;
  pos: PlayerRoleGroup;
  subPos?: string | null;
  clubSlug: string;
}): RosterPlayer {
  const cleanName = input.name.trim() || 'Custom Player';
  const parts = cleanName.split(/\s+/);
  const shortName = parts.length > 1 ? parts[parts.length - 1] : cleanName;
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    shortName,
    number: input.number.trim(),
    pos: input.pos,
    subPos: input.subPos ?? input.pos,
    clubSlug: input.clubSlug,
    nation: null,
    age: null,
    starts: null,
    min: null,
    gls: null,
    ast: null,
    source: 'custom',
  };
}

export const PITCH_W = 1050;
export const PITCH_H = 680;

export type PitchView = 'full' | 'half-left' | 'half-right';
export type PitchOrientation = 'horizontal' | 'vertical';
export type PitchTheme =
  | 'emerald'
  | 'dark-slate'
  | 'blueprint'
  | 'broadcast'
  | 'light-tactical';
export type ZoneOverlay =
  | 'none'
  | 'channels'
  | 'thirds'
  | 'grid-18'
  | 'jdp-20'
  | 'zone-14';
export type StudioTheme = 'dark' | 'light';
export type TacticalPhasePresetId =
  | 'buildup-325'
  | 'attack-235'
  | 'high-press-442'
  | 'low-block-541';

export type DrawingTool =
  | 'select'
  | 'line'
  | 'arrow'
  | 'dashed-arrow'
  | 'curved-arrow'
  | 'freehand'
  | 'circle'
  | 'rectangle'
  | 'highlight'
  | 'ellipse-highlight'
  | 'text'
  | 'ball'
  | 'eraser';

export type TeamSide = 'home' | 'away';
export type PlayerRoleGroup = 'GK' | 'DF' | 'MF' | 'FW';
export type PlayerDataSource = 'epl-data' | 'custom' | 'external-api';

export type FormationId =
  | '4-3-3'
  | '4-2-3-1'
  | '4-4-2'
  | '3-4-3'
  | '3-5-2'
  | '4-1-4-1'
  | '4-4-2-diamond'
  | '3-4-2-1'
  | '5-3-2'
  | 'custom';

export interface TacticalClub {
  slug: string;
  name: string;
  shortName: string;
  nameTh: string | null;
  color: string;
  secondaryColor: string;
  logo: string | null;
  latestSeason: string;
  isCurrentPl: boolean;
}

export interface RosterPlayer {
  id: string;
  name: string;
  shortName: string;
  /** Official shirt number if present in real match data; empty string if unknown/unset */
  number: string;
  pos: PlayerRoleGroup;
  subPos: string | null;
  clubSlug: string;
  nation: string | null;
  age: number | null;
  starts: number | null;
  min: number | null;
  gls: number | null;
  ast: number | null;
  source: PlayerDataSource;
}

export interface TacticalBootstrapData {
  season: string;
  clubs: TacticalClub[];
  rosters: Record<string, RosterPlayer[]>;
}

export interface BoardPlayer {
  id: string;
  rosterId: string | null;
  team: TeamSide;
  name: string;
  shortName: string;
  number: string;
  pos: PlayerRoleGroup;
  slotRole: string;
  /** Logical pitch X: 0..1050 */
  x: number;
  /** Logical pitch Y: 0..680 */
  y: number;
  /** Individual scale multiplier, default 1 */
  size: number;
  isGk: boolean;
  source: PlayerDataSource;
  customColor?: string;
}

export interface BallMarker {
  id: string;
  x: number;
  y: number;
  size: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BaseDrawing {
  id: string;
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface LineDrawing extends BaseDrawing {
  type: 'line' | 'arrow' | 'dashed-arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CurvedArrowDrawing extends BaseDrawing {
  type: 'curved-arrow';
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  x2: number;
  y2: number;
}

export interface FreehandDrawing extends BaseDrawing {
  type: 'freehand';
  points: Point[];
}

export interface CircleDrawing extends BaseDrawing {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
  fillOpacity: number;
}

export interface RectDrawing extends BaseDrawing {
  type: 'rectangle' | 'highlight';
  x: number;
  y: number;
  w: number;
  h: number;
  fillOpacity: number;
}

export interface EllipseHighlightDrawing extends BaseDrawing {
  type: 'ellipse-highlight';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fillOpacity: number;
}

export interface TextDrawing extends BaseDrawing {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bgOpacity: number;
}

export type DrawingObject =
  | LineDrawing
  | CurvedArrowDrawing
  | FreehandDrawing
  | CircleDrawing
  | RectDrawing
  | EllipseHighlightDrawing
  | TextDrawing;

export interface DrawingStyle {
  color: string;
  strokeWidth: number;
  opacity: number;
  fillOpacity: number;
  fontSize: number;
}

export interface PitchConfig {
  view: PitchView;
  orientation: PitchOrientation;
  theme: PitchTheme;
  zoneOverlay: ZoneOverlay;
  showNames: boolean;
  showNumbers: boolean;
  showRoles: boolean;
  showTrails: boolean;
  playerSize: number;
}

export interface TeamConfig {
  clubSlug: string | null;
  clubName: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  gkColor: string;
  formation: FormationId;
  visible: boolean;
  customPlayers: RosterPlayer[];
}

export interface TacticalScene {
  id: string;
  name: string;
  notes: string;
  durationMs: number;
  players: BoardPlayer[];
  balls: BallMarker[];
  drawings: DrawingObject[];
}

export interface TacticalProject {
  id: string;
  schemaVersion: 1;
  name: string;
  createdAt: string;
  updatedAt: string;
  pitch: PitchConfig;
  home: TeamConfig;
  away: TeamConfig;
  scenes: TacticalScene[];
  activeSceneId: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  homeClub: string;
  awayClub: string;
  homeLogo: string | null;
  awayLogo: string | null;
  sceneCount: number;
  updatedAt: string;
}

export interface CustomFormationPreset {
  id: string;
  name: string;
  slots: { role: string; group: PlayerRoleGroup; x: number; y: number }[];
}

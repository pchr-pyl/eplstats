import { create } from 'zustand';
import {
  createCustomRosterPlayer,
  EplLocalDataProvider,
  type TeamDataProvider,
} from './dataProvider';
import {
  applyFormationToExistingPlayers,
  buildLineupFromRoster,
  getSlotsForSide,
  getTacticalPhasePreset,
} from './formations';
import {
  clampLogical,
  defaultCurveControlPoint,
  translateDrawing,
} from './geometry';
import {
  deleteStoredProject,
  getLastOpenedProjectId,
  listStoredProjects,
  loadStoredProject,
  parseImportedProjectJson,
  saveStoredProject,
} from './storage';
import {
  PITCH_H,
  PITCH_W,
  type BallMarker,
  type BoardPlayer,
  type DrawingObject,
  type DrawingStyle,
  type DrawingTool,
  type FormationId,
  type PitchConfig,
  type PlayerRoleGroup,
  type Point,
  type ProjectSummary,
  type RosterPlayer,
  type StudioTheme,
  type TacticalBootstrapData,
  type TacticalClub,
  type TacticalPhasePresetId,
  type TacticalProject,
  type TacticalScene,
  type TeamConfig,
  type TeamSide,
} from './types';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

interface HistorySnapshot {
  scenes: TacticalScene[];
  activeSceneId: string;
  homeFormation: FormationId;
  awayFormation: FormationId;
}

const MAX_HISTORY = 60;

export const DEFAULT_PITCH_CONFIG: PitchConfig = {
  view: 'full',
  orientation: 'horizontal',
  theme: 'emerald',
  zoneOverlay: 'none',
  showNames: true,
  showNumbers: true,
  showRoles: false,
  showTrails: true,
  playerSize: 1,
};

export const DEFAULT_DRAW_STYLE: DrawingStyle = {
  color: '#facc15',
  strokeWidth: 3.5,
  opacity: 0.95,
  fillOpacity: 0.22,
  fontSize: 18,
};

function makeTeamConfig(
  club: TacticalClub | null,
  fallbackName: string,
  fallbackColor: string,
  formation: FormationId,
  gkColor: string,
): TeamConfig {
  return {
    clubSlug: club?.slug ?? null,
    clubName: club?.name ?? fallbackName,
    logo: club?.logo ?? null,
    primaryColor: club?.color ?? fallbackColor,
    secondaryColor: club?.secondaryColor ?? '#ffffff',
    gkColor,
    formation,
    visible: true,
    customPlayers: [],
  };
}

function buildInitialProject(
  provider: EplLocalDataProvider,
  name = 'Match Tactical Plan',
  homeSlug = 'arsenal',
  awaySlug = 'liverpool',
): TacticalProject {
  const clubs = provider.getClubsSync();
  const homeClub =
    clubs.find((c) => c.slug === homeSlug) ?? clubs[0] ?? null;
  const awayClub =
    clubs.find((c) => c.slug === awaySlug && c.slug !== homeClub?.slug) ??
    clubs.find((c) => c.slug !== homeClub?.slug) ??
    clubs[1] ??
    null;

  const homeRoster = homeClub ? provider.getClubRosterSync(homeClub.slug) : [];
  const awayRoster = awayClub ? provider.getClubRosterSync(awayClub.slug) : [];

  const homePlayers = buildLineupFromRoster(homeRoster, '4-3-3', 'home');
  const awayPlayers = buildLineupFromRoster(awayRoster, '4-2-3-1', 'away');

  const sceneId = uid('scene');
  const now = new Date().toISOString();

  // Ensure away color contrasts visually with home color if both are red
  const awayConfig = makeTeamConfig(
    awayClub,
    'Away XI',
    '#2563eb',
    '4-2-3-1',
    '#f97316',
  );
  if (
    homeClub &&
    awayClub &&
    colorsTooClose(homeClub.color, awayClub.color)
  ) {
    awayConfig.primaryColor = '#1e293b';
    awayConfig.secondaryColor = '#f8fafc';
  }

  return {
    id: uid('proj'),
    schemaVersion: 1,
    name,
    createdAt: now,
    updatedAt: now,
    pitch: { ...DEFAULT_PITCH_CONFIG },
    home: makeTeamConfig(homeClub, 'Home XI', '#ef4444', '4-3-3', '#eab308'),
    away: awayConfig,
    scenes: [
      {
        id: sceneId,
        name: 'Scene 1: Base Shape',
        notes: 'Initial team shape and pressing reference.',
        durationMs: 1600,
        players: [...homePlayers, ...awayPlayers],
        balls: [{ id: 'ball-main', x: PITCH_W / 2, y: PITCH_H / 2, size: 1 }],
        drawings: [],
      },
    ],
    activeSceneId: sceneId,
  };
}

function colorsTooClose(hexA: string, hexB: string): boolean {
  const parse = (h: string) => {
    const c = h.replace('#', '');
    if (c.length !== 6) return [128, 128, 128];
    return [
      parseInt(c.slice(0, 2), 16),
      parseInt(c.slice(2, 4), 16),
      parseInt(c.slice(4, 6), 16),
    ];
  };
  const a = parse(hexA);
  const b = parse(hexB);
  const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return dist < 110;
}

export interface TacticalStore {
  initialized: boolean;
  provider: EplLocalDataProvider | null;
  externalProviders: TeamDataProvider[];
  clubs: TacticalClub[];

  project: TacticalProject | null;
  savedProjects: ProjectSummary[];
  isDirty: boolean;
  lastSavedAt: string | null;

  tool: DrawingTool;
  drawStyle: DrawingStyle;
  selectedIds: string[];

  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // Animation playback
  isPlaying: boolean;
  playhead: number;
  playbackSpeed: number;
  loop: boolean;

  // UI Studio Theme (Dark default, toggleable to Light)
  studioTheme: StudioTheme;

  // Toast feedback
  toast: string | null;

  // Init & utility
  init: (
    bootstrap: TacticalBootstrapData,
    opts?: { homeSlug?: string; awaySlug?: string },
  ) => Promise<void>;
  setStudioTheme: (theme: StudioTheme) => void;
  toggleStudioTheme: () => void;
  registerExternalProvider: (provider: TeamDataProvider) => void;
  getTeamRoster: (side: TeamSide) => RosterPlayer[];
  showToast: (msg: string) => void;

  // Tool & Style
  setTool: (tool: DrawingTool) => void;
  setDrawStyle: (patch: Partial<DrawingStyle>) => void;
  setPitchConfig: (patch: Partial<PitchConfig>) => void;

  // Selection
  selectOnly: (id: string) => void;
  toggleSelect: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;

  // History
  captureHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Board mutations
  moveSelectedBy: (dx: number, dy: number) => void;
  movePlayerTo: (playerId: string, x: number, y: number) => void;
  moveBallTo: (ballId: string, x: number, y: number) => void;
  updateBoardPlayer: (playerId: string, patch: Partial<BoardPlayer>) => void;
  addPlayerToPitch: (
    side: TeamSide,
    rosterPlayer: RosterPlayer,
    pos?: Point,
    swapWithPlayerId?: string,
  ) => void;
  removePlayerFromPitch: (playerId: string) => void;
  addCustomPlayer: (
    side: TeamSide,
    input: { name: string; number: string; pos: PlayerRoleGroup; subPos?: string },
    placeOnPitch?: boolean,
  ) => RosterPlayer | null;
  deleteCustomPlayer: (side: TeamSide, rosterId: string) => void;

  // Team config & formations
  setClub: (side: TeamSide, clubSlug: string) => void;
  setTeamFormation: (
    side: TeamSide,
    formationId: FormationId,
    customSlots?: { role: string; group: PlayerRoleGroup; x: number; y: number }[],
  ) => void;
  applyTacticalPhasePreset: (
    side: TeamSide,
    presetId: TacticalPhasePresetId,
  ) => void;
  setTeamVisible: (side: TeamSide, visible: boolean) => void;
  setTeamColors: (
    side: TeamSide,
    patch: Partial<Pick<TeamConfig, 'primaryColor' | 'secondaryColor' | 'gkColor'>>,
  ) => void;

  // Drawings & Balls
  addDrawing: (drawing: DrawingObject) => void;
  updateDrawing: (id: string, patch: Partial<DrawingObject>) => void;
  updateSelectedDrawingsStyle: (patch: Partial<DrawingStyle>) => void;
  removeDrawing: (id: string) => void;
  addBall: (x: number, y: number) => void;
  removeBall: (id: string) => void;
  deleteSelected: () => void;
  clearDrawings: () => void;
  clearAllObjects: () => void;

  // Scenes & Animation
  selectScene: (sceneId: string) => void;
  addScene: (mode?: 'clone' | 'clean') => void;
  duplicateScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  updateSceneNotes: (sceneId: string, notes: string) => void;
  updateSceneDuration: (sceneId: string, durationMs: number) => void;
  deleteScene: (sceneId: string) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setPlayhead: (val: number) => void;
  resetPlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  loadHalfSpaceDemo: () => void;

  // Projects
  refreshSavedProjects: () => Promise<void>;
  newProject: (name?: string) => Promise<void>;
  saveCurrentProject: (silent?: boolean) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (name: string) => void;
  duplicateCurrentProject: () => Promise<void>;
  deleteProjectById: (id: string) => Promise<void>;
  resetBoard: () => void;
  importProjectJson: (rawText: string) => Promise<void>;
}

function getActiveScene(project: TacticalProject): TacticalScene {
  return (
    project.scenes.find((s) => s.id === project.activeSceneId) ??
    project.scenes[0]
  );
}

function updateActiveScene(
  project: TacticalProject,
  updater: (scene: TacticalScene) => TacticalScene,
): TacticalProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    scenes: project.scenes.map((s) =>
      s.id === project.activeSceneId ? updater(s) : s,
    ),
  };
}

function snapshotOf(project: TacticalProject): HistorySnapshot {
  return {
    scenes: deepClone(project.scenes),
    activeSceneId: project.activeSceneId,
    homeFormation: project.home.formation,
    awayFormation: project.away.formation,
  };
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useTacticalStore = create<TacticalStore>((set, get) => ({
  initialized: false,
  provider: null,
  externalProviders: [],
  clubs: [],

  project: null,
  savedProjects: [],
  isDirty: false,
  lastSavedAt: null,

  tool: 'select',
  drawStyle: { ...DEFAULT_DRAW_STYLE },
  selectedIds: [],

  past: [],
  future: [],

  isPlaying: false,
  playhead: 0,
  playbackSpeed: 1,
  loop: false,

  studioTheme: 'dark',

  toast: null,

  setStudioTheme: (studioTheme) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tb-studio-theme', studioTheme);
      } catch {
        // ignore
      }
    }
    set({ studioTheme });
  },

  toggleStudioTheme: () => {
    const next: StudioTheme = get().studioTheme === 'dark' ? 'light' : 'dark';
    get().setStudioTheme(next);
  },

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => {
      set({ toast: null });
    }, 2600);
  },

  init: async (bootstrap, opts) => {
    if (get().initialized) return;
    const provider = new EplLocalDataProvider(bootstrap);
    const clubs = provider.getClubsSync();
    const savedProjects = await listStoredProjects();
    const lastId = getLastOpenedProjectId();
    let project: TacticalProject | null = null;

    if (lastId) {
      project = await loadStoredProject(lastId);
    }
    if (!project) {
      project = buildInitialProject(
        provider,
        'Match Tactical Plan',
        opts?.homeSlug ?? 'arsenal',
        opts?.awaySlug ?? 'liverpool',
      );
      await saveStoredProject(project);
    }

    const activeIdx = Math.max(
      0,
      project.scenes.findIndex((s) => s.id === project!.activeSceneId),
    );
    const refreshed = await listStoredProjects();
    let savedStudioTheme: StudioTheme = 'dark';
    if (typeof window !== 'undefined') {
      try {
        const storedTheme = localStorage.getItem('tb-studio-theme');
        if (storedTheme === 'light' || storedTheme === 'dark') {
          savedStudioTheme = storedTheme;
        }
      } catch {
        // ignore
      }
    }

    set({
      initialized: true,
      provider,
      clubs,
      project,
      savedProjects: refreshed.length ? refreshed : savedProjects,
      isDirty: false,
      lastSavedAt: project.updatedAt,
      playhead: activeIdx,
      studioTheme: savedStudioTheme,
    });
  },

  registerExternalProvider: (external) => {
    set((s) => ({
      externalProviders: [
        ...s.externalProviders.filter((p) => p.id !== external.id),
        external,
      ],
    }));
  },

  getTeamRoster: (side) => {
    const { provider, project } = get();
    if (!project) return [];
    const team = project[side];
    const base =
      provider && team.clubSlug
        ? provider.getClubRosterSync(team.clubSlug)
        : [];
    return [...team.customPlayers, ...base];
  },

  setTool: (tool) => set({ tool }),

  setDrawStyle: (patch) =>
    set((s) => ({ drawStyle: { ...s.drawStyle, ...patch } })),

  setPitchConfig: (patch) =>
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          pitch: { ...s.project.pitch, ...patch },
        },
        isDirty: true,
      };
    }),

  selectOnly: (id) => set({ selectedIds: [id] }),

  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  clearSelection: () => set({ selectedIds: [] }),

  captureHistory: () => {
    const { project, past } = get();
    if (!project) return;
    const snap = snapshotOf(project);
    set({
      past: [...past.slice(-(MAX_HISTORY - 1)), snap],
      future: [],
    });
  },

  undo: () => {
    const { project, past, future } = get();
    if (!project || past.length === 0) return;
    const prev = past[past.length - 1];
    const currentSnap = snapshotOf(project);
    const nextIdx = Math.max(
      0,
      prev.scenes.findIndex((s) => s.id === prev.activeSceneId),
    );
    set({
      project: {
        ...project,
        updatedAt: new Date().toISOString(),
        scenes: deepClone(prev.scenes),
        activeSceneId: prev.activeSceneId,
        home: { ...project.home, formation: prev.homeFormation },
        away: { ...project.away, formation: prev.awayFormation },
      },
      past: past.slice(0, -1),
      future: [currentSnap, ...future.slice(0, MAX_HISTORY - 1)],
      selectedIds: [],
      isPlaying: false,
      playhead: nextIdx,
      isDirty: true,
    });
  },

  redo: () => {
    const { project, past, future } = get();
    if (!project || future.length === 0) return;
    const next = future[0];
    const currentSnap = snapshotOf(project);
    const nextIdx = Math.max(
      0,
      next.scenes.findIndex((s) => s.id === next.activeSceneId),
    );
    set({
      project: {
        ...project,
        updatedAt: new Date().toISOString(),
        scenes: deepClone(next.scenes),
        activeSceneId: next.activeSceneId,
        home: { ...project.home, formation: next.homeFormation },
        away: { ...project.away, formation: next.awayFormation },
      },
      past: [...past, currentSnap],
      future: future.slice(1),
      selectedIds: [],
      isPlaying: false,
      playhead: nextIdx,
      isDirty: true,
    });
  },

  moveSelectedBy: (dx, dy) =>
    set((s) => {
      if (!s.project || s.selectedIds.length === 0) return s;
      const sel = new Set(s.selectedIds);
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          players: scene.players.map((p) => {
            if (!sel.has(p.id)) return p;
            const c = clampLogical({ x: p.x + dx, y: p.y + dy });
            return { ...p, x: c.x, y: c.y };
          }),
          balls: scene.balls.map((b) => {
            if (!sel.has(b.id)) return b;
            const c = clampLogical({ x: b.x + dx, y: b.y + dy });
            return { ...b, x: c.x, y: c.y };
          }),
          drawings: scene.drawings.map((d) =>
            sel.has(d.id) ? translateDrawing(d, dx, dy) : d,
          ),
        })),
        isDirty: true,
      };
    }),

  movePlayerTo: (playerId, x, y) =>
    set((s) => {
      if (!s.project) return s;
      const c = clampLogical({ x, y });
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          players: scene.players.map((p) =>
            p.id === playerId ? { ...p, x: c.x, y: c.y } : p,
          ),
        })),
        isDirty: true,
      };
    }),

  moveBallTo: (ballId, x, y) =>
    set((s) => {
      if (!s.project) return s;
      const c = clampLogical({ x, y });
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          balls: scene.balls.map((b) =>
            b.id === ballId ? { ...b, x: c.x, y: c.y } : b,
          ),
        })),
        isDirty: true,
      };
    }),

  updateBoardPlayer: (playerId, patch) => {
    get().captureHistory();
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          players: scene.players.map((p) =>
            p.id === playerId ? { ...p, ...patch } : p,
          ),
        })),
        isDirty: true,
      };
    });
  },

  addPlayerToPitch: (side, rosterPlayer, pos, swapWithPlayerId) => {
    const { project } = get();
    if (!project) return;
    get().captureHistory();

    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => {
          // If already on pitch, just select/move
          const existingOnPitch = scene.players.find(
            (p) => p.team === side && p.rosterId === rosterPlayer.id,
          );
          if (existingOnPitch) {
            if (pos) {
              const c = clampLogical(pos);
              return {
                ...scene,
                players: scene.players.map((p) =>
                  p.id === existingOnPitch.id ? { ...p, x: c.x, y: c.y } : p,
                ),
              };
            }
            return scene;
          }

          // Swap with a specific target player if provided
          if (swapWithPlayerId) {
            return {
              ...scene,
              players: scene.players.map((p) =>
                p.id === swapWithPlayerId
                  ? {
                      ...p,
                      rosterId: rosterPlayer.id,
                      name: rosterPlayer.name,
                      shortName: rosterPlayer.shortName,
                      number: rosterPlayer.number,
                      pos: rosterPlayer.pos,
                      source: rosterPlayer.source,
                    }
                  : p,
              ),
            };
          }

          // Otherwise place at dropped pos (or sensible center spot)
          const teamCount = scene.players.filter((p) => p.team === side).length;
          const fallbackX =
            side === 'home'
              ? 300 + (teamCount % 4) * 55
              : PITCH_W - 300 - (teamCount % 4) * 55;
          const fallbackY = 180 + (teamCount % 5) * 75;
          const c = clampLogical(pos ?? { x: fallbackX, y: fallbackY });
          const newPlayer: BoardPlayer = {
            id: uid(`${side}-p`),
            rosterId: rosterPlayer.id,
            team: side,
            name: rosterPlayer.name,
            shortName: rosterPlayer.shortName,
            number: rosterPlayer.number,
            pos: rosterPlayer.pos,
            slotRole: rosterPlayer.subPos ?? rosterPlayer.pos,
            x: c.x,
            y: c.y,
            size: 1,
            isGk: rosterPlayer.pos === 'GK',
            source: rosterPlayer.source,
          };
          return { ...scene, players: [...scene.players, newPlayer] };
        }),
        isDirty: true,
      };
    });
  },

  removePlayerFromPitch: (playerId) => {
    get().captureHistory();
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          players: scene.players.filter((p) => p.id !== playerId),
        })),
        selectedIds: s.selectedIds.filter((id) => id !== playerId),
        isDirty: true,
      };
    });
  },

  addCustomPlayer: (side, input, placeOnPitch = false) => {
    const { project } = get();
    if (!project) return null;
    const clubSlug = project[side].clubSlug ?? 'custom';
    const created = createCustomRosterPlayer({
      ...input,
      clubSlug,
    });
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          [side]: {
            ...s.project[side],
            customPlayers: [created, ...s.project[side].customPlayers],
          },
        },
        isDirty: true,
      };
    });
    if (placeOnPitch) {
      get().addPlayerToPitch(side, created);
    }
    get().showToast(`Added custom player: ${created.name}`);
    return created;
  },

  deleteCustomPlayer: (side, rosterId) => {
    get().captureHistory();
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          [side]: {
            ...s.project[side],
            customPlayers: s.project[side].customPlayers.filter(
              (p) => p.id !== rosterId,
            ),
          },
          scenes: s.project.scenes.map((scene) => ({
            ...scene,
            players: scene.players.filter((p) => p.rosterId !== rosterId),
          })),
        },
        isDirty: true,
      };
    });
  },

  setClub: (side, clubSlug) => {
    const { provider, project, clubs } = get();
    if (!provider || !project) return;
    const club = clubs.find((c) => c.slug === clubSlug);
    if (!club) return;

    get().captureHistory();

    const roster = [
      ...project[side].customPlayers,
      ...provider.getClubRosterSync(club.slug),
    ];
    const formation = project[side].formation;
    const freshLineup = buildLineupFromRoster(roster, formation, side);
    const otherSide: TeamSide = side === 'home' ? 'away' : 'home';
    let primaryColor = club.color;
    let secondaryColor = club.secondaryColor;
    if (colorsTooClose(primaryColor, project[otherSide].primaryColor)) {
      primaryColor = side === 'away' ? '#1e293b' : club.color;
      secondaryColor = '#f8fafc';
    }

    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...updateActiveScene(s.project, (scene) => ({
            ...scene,
            players: [
              ...scene.players.filter((p) => p.team !== side),
              ...freshLineup,
            ],
          })),
          [side]: {
            ...s.project[side],
            clubSlug: club.slug,
            clubName: club.name,
            logo: club.logo,
            primaryColor,
            secondaryColor,
          },
        },
        selectedIds: [],
        isDirty: true,
      };
    });
    get().showToast(`Loaded ${club.name} (${club.latestSeason})`);
  },

  setTeamFormation: (side, formationId, customSlots) => {
    const { project } = get();
    if (!project) return;
    get().captureHistory();

    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...updateActiveScene(s.project, (scene) => {
            const teamPlayers = scene.players.filter((p) => p.team === side);
            if (teamPlayers.length === 0) {
              const roster = get().getTeamRoster(side);
              const fresh = buildLineupFromRoster(
                roster,
                formationId,
                side,
                customSlots,
              );
              return { ...scene, players: [...scene.players, ...fresh] };
            }
            return {
              ...scene,
              players: applyFormationToExistingPlayers(
                scene.players,
                formationId,
                side,
                customSlots,
              ),
            };
          }),
          [side]: {
            ...s.project[side],
            formation: formationId,
          },
        },
        isDirty: true,
      };
    });
  },

  applyTacticalPhasePreset: (side, presetId) => {
    const preset = getTacticalPhasePreset(presetId);
    const { project } = get();
    if (!preset || !project) return;
    get().captureHistory();

    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...updateActiveScene(s.project, (scene) => {
            const teamPlayers = scene.players.filter((p) => p.team === side);
            if (teamPlayers.length === 0) {
              const roster = get().getTeamRoster(side);
              const fresh = buildLineupFromRoster(
                roster,
                'custom',
                side,
                preset.slots,
              );
              return { ...scene, players: [...scene.players, ...fresh] };
            }
            return {
              ...scene,
              players: applyFormationToExistingPlayers(
                scene.players,
                'custom',
                side,
                preset.slots,
              ),
            };
          }),
          pitch: {
            ...s.project.pitch,
            zoneOverlay: preset.recommendedOverlay,
          },
          [side]: {
            ...s.project[side],
            formation: 'custom',
          },
        },
        isDirty: true,
      };
    });
    get().showToast(`Applied ${preset.label} (${preset.tag})`);
  },

  setTeamVisible: (side, visible) =>
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          [side]: { ...s.project[side], visible },
        },
        isDirty: true,
      };
    }),

  setTeamColors: (side, patch) =>
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          [side]: { ...s.project[side], ...patch },
        },
        isDirty: true,
      };
    }),

  addDrawing: (drawing) => {
    get().captureHistory();
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          drawings: [...scene.drawings, drawing],
        })),
        selectedIds: [drawing.id],
        isDirty: true,
      };
    });
  },

  updateDrawing: (id, patch) =>
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          drawings: scene.drawings.map((d) =>
            d.id === id ? ({ ...d, ...patch } as DrawingObject) : d,
          ),
        })),
        isDirty: true,
      };
    }),

  updateSelectedDrawingsStyle: (patch) => {
    const { project, selectedIds } = get();
    if (!project || selectedIds.length === 0) return;
    get().captureHistory();
    const sel = new Set(selectedIds);
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          drawings: scene.drawings.map((d) => {
            if (!sel.has(d.id)) return d;
            const updated = { ...d };
            if (patch.color !== undefined) updated.color = patch.color;
            if (patch.strokeWidth !== undefined)
              updated.strokeWidth = patch.strokeWidth;
            if (patch.opacity !== undefined) updated.opacity = patch.opacity;
            if (
              patch.fillOpacity !== undefined &&
              'fillOpacity' in updated
            ) {
              updated.fillOpacity = patch.fillOpacity;
            }
            if (patch.fontSize !== undefined && updated.type === 'text') {
              updated.fontSize = patch.fontSize;
            }
            return updated;
          }),
        })),
        isDirty: true,
      };
    });
  },

  removeDrawing: (id) => {
    get().captureHistory();
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          drawings: scene.drawings.filter((d) => d.id !== id),
        })),
        selectedIds: s.selectedIds.filter((x) => x !== id),
        isDirty: true,
      };
    });
  },

  addBall: (x, y) => {
    get().captureHistory();
    const c = clampLogical({ x, y });
    const ball: BallMarker = { id: uid('ball'), x: c.x, y: c.y, size: 1 };
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          balls: [...scene.balls, ball],
        })),
        selectedIds: [ball.id],
        isDirty: true,
      };
    });
  },

  removeBall: (id) => {
    get().captureHistory();
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          balls: scene.balls.filter((b) => b.id !== id),
        })),
        selectedIds: s.selectedIds.filter((x) => x !== id),
        isDirty: true,
      };
    });
  },

  deleteSelected: () => {
    const { project, selectedIds } = get();
    if (!project || selectedIds.length === 0) return;
    get().captureHistory();
    const sel = new Set(selectedIds);
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          drawings: scene.drawings.filter((d) => !sel.has(d.id)),
          balls: scene.balls.filter((b) => !sel.has(b.id)),
          players: scene.players.filter((p) => !sel.has(p.id)),
        })),
        selectedIds: [],
        isDirty: true,
      };
    });
  },

  clearDrawings: () => {
    const { project } = get();
    if (!project) return;
    const active = getActiveScene(project);
    if (active.drawings.length === 0) return;
    get().captureHistory();
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          drawings: [],
        })),
        selectedIds: [],
        isDirty: true,
      };
    });
    get().showToast('Cleared all drawings in scene');
  },

  clearAllObjects: () => {
    const { project } = get();
    if (!project) return;
    get().captureHistory();
    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          drawings: [],
          balls: [],
        })),
        selectedIds: [],
        isDirty: true,
      };
    });
    get().showToast('Cleared drawings & markers');
  },

  selectScene: (sceneId) =>
    set((s) => {
      if (!s.project) return s;
      const idx = s.project.scenes.findIndex((sc) => sc.id === sceneId);
      if (idx === -1) return s;
      return {
        project: { ...s.project, activeSceneId: sceneId },
        selectedIds: [],
        isPlaying: false,
        playhead: idx,
      };
    }),

  addScene: (mode = 'clone') => {
    const { project } = get();
    if (!project) return;
    get().captureHistory();
    const current = getActiveScene(project);
    const nextNum = project.scenes.length + 1;
    const newId = uid('scene');
    const newScene: TacticalScene =
      mode === 'clone'
        ? {
            id: newId,
            name: `Scene ${nextNum}`,
            notes: '',
            durationMs: current.durationMs,
            players: deepClone(current.players),
            balls: deepClone(current.balls),
            drawings: [],
          }
        : {
            id: newId,
            name: `Scene ${nextNum}`,
            notes: '',
            durationMs: 1600,
            players: deepClone(current.players),
            balls: [{ id: 'ball-main', x: PITCH_W / 2, y: PITCH_H / 2, size: 1 }],
            drawings: [],
          };

    set((s) => {
      if (!s.project) return s;
      const scenes = [...s.project.scenes, newScene];
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          scenes,
          activeSceneId: newId,
        },
        selectedIds: [],
        isPlaying: false,
        playhead: scenes.length - 1,
        isDirty: true,
      };
    });
  },

  duplicateScene: (sceneId) => {
    const { project } = get();
    if (!project) return;
    const idx = project.scenes.findIndex((sc) => sc.id === sceneId);
    if (idx === -1) return;
    get().captureHistory();
    const src = project.scenes[idx];
    const copyId = uid('scene');
    const copy: TacticalScene = {
      ...deepClone(src),
      id: copyId,
      name: `${src.name} (Copy)`,
    };
    const nextScenes = [
      ...project.scenes.slice(0, idx + 1),
      copy,
      ...project.scenes.slice(idx + 1),
    ];
    set({
      project: {
        ...project,
        updatedAt: new Date().toISOString(),
        scenes: nextScenes,
        activeSceneId: copyId,
      },
      selectedIds: [],
      isPlaying: false,
      playhead: idx + 1,
      isDirty: true,
    });
  },

  renameScene: (sceneId, name) =>
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          scenes: s.project.scenes.map((sc) =>
            sc.id === sceneId ? { ...sc, name } : sc,
          ),
        },
        isDirty: true,
      };
    }),

  updateSceneNotes: (sceneId, notes) =>
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          scenes: s.project.scenes.map((sc) =>
            sc.id === sceneId ? { ...sc, notes } : sc,
          ),
        },
        isDirty: true,
      };
    }),

  updateSceneDuration: (sceneId, durationMs) =>
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          scenes: s.project.scenes.map((sc) =>
            sc.id === sceneId ? { ...sc, durationMs } : sc,
          ),
        },
        isDirty: true,
      };
    }),

  deleteScene: (sceneId) => {
    const { project } = get();
    if (!project || project.scenes.length <= 1) {
      get().showToast('At least one scene is required');
      return;
    }
    get().captureHistory();
    const idx = project.scenes.findIndex((sc) => sc.id === sceneId);
    const nextScenes = project.scenes.filter((sc) => sc.id !== sceneId);
    const nextActive =
      project.activeSceneId === sceneId
        ? nextScenes[Math.max(0, idx - 1)].id
        : project.activeSceneId;
    const nextIdx = Math.max(
      0,
      nextScenes.findIndex((sc) => sc.id === nextActive),
    );
    set({
      project: {
        ...project,
        updatedAt: new Date().toISOString(),
        scenes: nextScenes,
        activeSceneId: nextActive,
      },
      selectedIds: [],
      isPlaying: false,
      playhead: nextIdx,
      isDirty: true,
    });
  },

  setPlaying: (playing) => {
    const { project, playhead } = get();
    if (!project || project.scenes.length < 2) {
      if (playing) get().showToast('Add at least 2 scenes to play animation');
      set({ isPlaying: false });
      return;
    }
    if (playing && playhead >= project.scenes.length - 1) {
      set({ isPlaying: true, playhead: 0, selectedIds: [] });
    } else {
      set({ isPlaying: playing, selectedIds: playing ? [] : get().selectedIds });
    }
  },

  togglePlaying: () => get().setPlaying(!get().isPlaying),

  setPlayhead: (val) =>
    set((s) => {
      if (!s.project) return s;
      const max = Math.max(0, s.project.scenes.length - 1);
      const clamped = Math.max(0, Math.min(max, val));
      const nearestIdx = Math.round(clamped);
      const nearestScene = s.project.scenes[nearestIdx];
      return {
        playhead: clamped,
        project: nearestScene
          ? { ...s.project, activeSceneId: nearestScene.id }
          : s.project,
      };
    }),

  resetPlayback: () =>
    set((s) => {
      if (!s.project) return s;
      return {
        isPlaying: false,
        playhead: 0,
        project: {
          ...s.project,
          activeSceneId: s.project.scenes[0].id,
        },
      };
    }),

  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

  setLoop: (loop) => set({ loop }),

  /**
   * Builds the 4-scene tactical progression demo using the currently selected REAL clubs:
   * Scene 1: 4-3-3 Base Build-up
   * Scene 2: Fullback pushes high into attacking width
   * Scene 3: Midfielder attacks the right Half-space pocket
   * Scene 4: Striker makes diagonal channel run to open space + through-ball
   */
  loadHalfSpaceDemo: () => {
    const { project } = get();
    if (!project) return;
    get().captureHistory();

    const homeRoster = get().getTeamRoster('home');
    const awayRoster = get().getTeamRoster('away');
    const baseHome = buildLineupFromRoster(homeRoster, '4-3-3', 'home');
    const baseAway = buildLineupFromRoster(awayRoster, '4-4-2', 'away').map(
      (p) => ({
        ...p,
        // Shift away slightly deeper in mid-block
        x: p.isGk ? p.x : Math.min(PITCH_W - 95, p.x + 70),
      }),
    );

    const byRole = (list: BoardPlayer[], role: string) =>
      list.find((p) => p.slotRole === role);

    // Scene 1: 4-3-3 Base shape
    const s1Players = [...deepClone(baseHome), ...deepClone(baseAway)];
    const rcb1 = byRole(s1Players, 'RCB');
    const s1: TacticalScene = {
      id: uid('scene'),
      name: 'Scene 1: 4-3-3 Build-up',
      notes: 'Starting 4-3-3 structure against a compact 4-4-2 mid-block.',
      durationMs: 1700,
      players: s1Players,
      balls: [
        {
          id: 'ball-main',
          x: (rcb1?.x ?? 200) + 28,
          y: (rcb1?.y ?? 420) - 8,
          size: 1,
        },
      ],
      drawings: [
        {
          id: uid('draw'),
          type: 'highlight',
          x: 610,
          y: 410,
          w: 220,
          h: 110,
          color: '#38bdf8',
          strokeWidth: 2,
          opacity: 0.9,
          fillOpacity: 0.16,
        },
        {
          id: uid('draw'),
          type: 'text',
          x: 720,
          y: 465,
          text: 'Target Right Half-Space',
          fontSize: 15,
          color: '#7dd3fc',
          strokeWidth: 0,
          opacity: 1,
          bgOpacity: 0.7,
        },
      ],
    };

    // Scene 2: Fullback pushes high, RW pins inside
    const s2Players = deepClone(s1Players).map((p) => {
      if (p.team === 'home') {
        if (p.slotRole === 'RB') return { ...p, x: 560, y: 612 };
        if (p.slotRole === 'RW') return { ...p, x: 645, y: 495 };
        if (p.slotRole === 'RCB') return { ...p, x: 290, y: 435 };
        if (p.slotRole === 'LCB') return { ...p, x: 270, y: 275 };
        if (p.slotRole === 'LB') return { ...p, x: 320, y: 145 };
        if (p.slotRole === 'DM') return { ...p, x: 420, y: 350 };
      }
      return p;
    });
    const rb2 = byRole(s2Players, 'RB');
    const dm2 = byRole(s2Players, 'DM');
    const s2: TacticalScene = {
      id: uid('scene'),
      name: 'Scene 2: Fullback Overlap',
      notes: 'Right-back surges high to stretch touchline; winger tucks inside to pin the opposition LB.',
      durationMs: 1700,
      players: s2Players,
      balls: [
        {
          id: 'ball-main',
          x: (dm2?.x ?? 420) + 22,
          y: (dm2?.y ?? 350) + 12,
          size: 1,
        },
      ],
      drawings: [
        {
          id: uid('draw'),
          type: 'dashed-arrow',
          x1: 230,
          y1: 575,
          x2: (rb2?.x ?? 560) - 24,
          y2: (rb2?.y ?? 612) - 4,
          color: '#22c55e',
          strokeWidth: 3.5,
          opacity: 0.95,
        },
        {
          id: uid('draw'),
          type: 'arrow',
          x1: 310,
          y1: 435,
          x2: (dm2?.x ?? 420) - 18,
          y2: (dm2?.y ?? 350) + 8,
          color: '#facc15',
          strokeWidth: 3,
          opacity: 0.9,
        },
      ],
    };

    // Scene 3: Midfielder (RCM) darts into Right Half-Space pocket
    const s3Players = deepClone(s2Players).map((p) => {
      if (p.team === 'home') {
        if (p.slotRole === 'RCM') return { ...p, x: 675, y: 462 };
        if (p.slotRole === 'RB') return { ...p, x: 650, y: 615 };
        if (p.slotRole === 'RW') return { ...p, x: 755, y: 558 };
        if (p.slotRole === 'LCM') return { ...p, x: 525, y: 225 };
        if (p.slotRole === 'LW') return { ...p, x: 660, y: 155 };
        if (p.slotRole === 'ST') return { ...p, x: 730, y: 345 };
      } else if (p.team === 'away') {
        if (p.slotRole === 'LM') return { ...p, x: 705, y: 540 };
        if (p.slotRole === 'LCM') return { ...p, x: 685, y: 405 };
      }
      return p;
    });
    const rcm3 = byRole(s3Players, 'RCM');
    const s3: TacticalScene = {
      id: uid('scene'),
      name: 'Scene 3: Half-Space Reception',
      notes: 'Right central midfielder ghosts between lines into the right half-space to receive on the half-turn.',
      durationMs: 1700,
      players: s3Players,
      balls: [
        {
          id: 'ball-main',
          x: (rcm3?.x ?? 675) + 22,
          y: (rcm3?.y ?? 462) - 4,
          size: 1,
        },
      ],
      drawings: [
        {
          id: uid('draw'),
          type: 'ellipse-highlight',
          cx: 675,
          cy: 462,
          rx: 56,
          ry: 38,
          color: '#38bdf8',
          strokeWidth: 2.5,
          opacity: 0.95,
          fillOpacity: 0.22,
        },
        {
          id: uid('draw'),
          type: 'arrow',
          x1: 445,
          y1: 356,
          x2: 646,
          y2: 452,
          color: '#facc15',
          strokeWidth: 3.5,
          opacity: 0.95,
        },
      ],
    };

    // Scene 4: Striker diagonal run behind CB to open space + curved through-ball
    const s4Players = deepClone(s3Players).map((p) => {
      if (p.team === 'home') {
        if (p.slotRole === 'ST') return { ...p, x: 890, y: 270 };
        if (p.slotRole === 'LW') return { ...p, x: 845, y: 215 };
        if (p.slotRole === 'RW') return { ...p, x: 860, y: 530 };
        if (p.slotRole === 'LCM') return { ...p, x: 670, y: 265 };
      } else if (p.team === 'away') {
        if (p.slotRole === 'LCB') return { ...p, x: 865, y: 318 };
        if (p.slotRole === 'RCB') return { ...p, x: 845, y: 425 };
      }
      return p;
    });
    const curveCtrl = defaultCurveControlPoint(695, 455, 882, 282, 0.24);
    const s4: TacticalScene = {
      id: uid('scene'),
      name: 'Scene 4: Striker Channel Run',
      notes: 'Striker curves diagonal run across CB into the channel; #8 slips reverse through-ball into space.',
      durationMs: 1800,
      players: s4Players,
      balls: [{ id: 'ball-main', x: 902, y: 278, size: 1 }],
      drawings: [
        {
          id: uid('draw'),
          type: 'curved-arrow',
          x1: 695,
          y1: 455,
          cx: curveCtrl.x,
          cy: curveCtrl.y,
          x2: 878,
          y2: 282,
          color: '#facc15',
          strokeWidth: 4,
          opacity: 0.95,
        },
        {
          id: uid('draw'),
          type: 'dashed-arrow',
          x1: 735,
          y1: 345,
          x2: 872,
          y2: 272,
          color: '#fb923c',
          strokeWidth: 3.5,
          opacity: 0.95,
        },
      ],
    };

    const scenes = [s1, s2, s3, s4];
    set({
      project: {
        ...project,
        updatedAt: new Date().toISOString(),
        pitch: { ...project.pitch, zoneOverlay: 'channels' },
        home: { ...project.home, formation: '4-3-3', visible: true },
        away: { ...project.away, formation: '4-4-2', visible: true },
        scenes,
        activeSceneId: s1.id,
      },
      selectedIds: [],
      isPlaying: false,
      playhead: 0,
      isDirty: true,
    });
    get().showToast('Loaded 4-Scene Half-Space Progression Demo — Press Space to Play!');
  },

  refreshSavedProjects: async () => {
    const list = await listStoredProjects();
    set({ savedProjects: list });
  },

  newProject: async (name) => {
    const { provider } = get();
    if (!provider) return;
    const fresh = buildInitialProject(
      provider,
      name?.trim() || `Tactical Plan ${get().savedProjects.length + 1}`,
    );
    await saveStoredProject(fresh);
    const list = await listStoredProjects();
    set({
      project: fresh,
      savedProjects: list,
      past: [],
      future: [],
      selectedIds: [],
      isPlaying: false,
      playhead: 0,
      isDirty: false,
      lastSavedAt: fresh.updatedAt,
    });
    get().showToast(`Created "${fresh.name}"`);
  },

  saveCurrentProject: async (silent = false) => {
    const { project } = get();
    if (!project) return;
    const stamped: TacticalProject = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    await saveStoredProject(stamped);
    const list = await listStoredProjects();
    set({
      project: stamped,
      savedProjects: list,
      isDirty: false,
      lastSavedAt: stamped.updatedAt,
    });
    if (!silent) get().showToast('Project saved');
  },

  openProject: async (id) => {
    const loaded = await loadStoredProject(id);
    if (!loaded) {
      get().showToast('Project not found');
      return;
    }
    const idx = Math.max(
      0,
      loaded.scenes.findIndex((s) => s.id === loaded.activeSceneId),
    );
    await saveStoredProject(loaded);
    set({
      project: loaded,
      past: [],
      future: [],
      selectedIds: [],
      isPlaying: false,
      playhead: idx,
      isDirty: false,
      lastSavedAt: loaded.updatedAt,
    });
    get().showToast(`Opened "${loaded.name}"`);
  },

  renameProject: (name) =>
    set((s) => {
      if (!s.project) return s;
      return {
        project: {
          ...s.project,
          name: name.trim() || 'Untitled Tactical Plan',
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  duplicateCurrentProject: async () => {
    const { project } = get();
    if (!project) return;
    const now = new Date().toISOString();
    const copy: TacticalProject = {
      ...deepClone(project),
      id: uid('proj'),
      name: `${project.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    await saveStoredProject(copy);
    const list = await listStoredProjects();
    set({
      project: copy,
      savedProjects: list,
      past: [],
      future: [],
      isDirty: false,
      lastSavedAt: now,
    });
    get().showToast(`Duplicated as "${copy.name}"`);
  },

  deleteProjectById: async (id) => {
    await deleteStoredProject(id);
    const list = await listStoredProjects();
    const { project } = get();
    if (project?.id === id) {
      if (list.length > 0) {
        await get().openProject(list[0].id);
      } else {
        await get().newProject('Match Tactical Plan');
      }
    } else {
      set({ savedProjects: list });
    }
    get().showToast('Project deleted');
  },

  resetBoard: () => {
    const { project } = get();
    if (!project) return;
    get().captureHistory();

    const homeRoster = get().getTeamRoster('home');
    const awayRoster = get().getTeamRoster('away');
    const homePlayers = buildLineupFromRoster(
      homeRoster,
      project.home.formation === 'custom' ? '4-3-3' : project.home.formation,
      'home',
    );
    const awayPlayers = buildLineupFromRoster(
      awayRoster,
      project.away.formation === 'custom' ? '4-2-3-1' : project.away.formation,
      'away',
    );

    const slotsOk = getSlotsForSide('4-3-3', 'home').length === 11;
    void slotsOk;

    set((s) => {
      if (!s.project) return s;
      return {
        project: updateActiveScene(s.project, (scene) => ({
          ...scene,
          players: [...homePlayers, ...awayPlayers],
          balls: [{ id: 'ball-main', x: PITCH_W / 2, y: PITCH_H / 2, size: 1 }],
          drawings: [],
        })),
        selectedIds: [],
        isDirty: true,
      };
    });
    get().showToast('Board reset to team formations');
  },

  importProjectJson: async (rawText) => {
    const imported = parseImportedProjectJson(rawText);
    await saveStoredProject(imported);
    const list = await listStoredProjects();
    const idx = Math.max(
      0,
      imported.scenes.findIndex((s) => s.id === imported.activeSceneId),
    );
    set({
      project: imported,
      savedProjects: list,
      past: [],
      future: [],
      selectedIds: [],
      isPlaying: false,
      playhead: idx,
      isDirty: false,
      lastSavedAt: imported.updatedAt,
    });
    get().showToast(`Imported "${imported.name}"`);
  },
}));

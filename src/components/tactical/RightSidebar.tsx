'use client';

import { useMemo, useState } from 'react';
import {
  Compass,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Palette,
  Plus,
  Search,
  Sliders,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  deleteCustomFormation,
  FORMATIONS,
  loadCustomFormations,
  saveCustomFormation,
  TACTICAL_PHASE_PRESETS,
} from '@/lib/tactical/formations';
import { useTacticalStore } from '@/lib/tactical/store';
import type {
  CustomFormationPreset,
  PitchTheme,
  PitchView,
  PlayerRoleGroup,
  RosterPlayer,
  TeamSide,
  ZoneOverlay,
} from '@/lib/tactical/types';
import { QUICK_COLORS } from './ToolDock';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export type SidebarTab = 'squad' | 'tactics' | 'style';

const POS_FILTERS: ('ALL' | PlayerRoleGroup)[] = ['ALL', 'GK', 'DF', 'MF', 'FW'];

export function RightSidebar({
  tab,
  onTabChange,
  onCloseMobile,
}: {
  tab: SidebarTab;
  onTabChange: (t: SidebarTab) => void;
  onCloseMobile: () => void;
}) {
  const project = useTacticalStore((s) => s.project);
  const selectedIds = useTacticalStore((s) => s.selectedIds);

  if (!project) return null;

  return (
    <aside className="flex h-full w-[310px] max-w-[88vw] shrink-0 flex-col border-l border-tb-border bg-tb-panel text-tb-text">
      {/* Tab Header */}
      <div className="flex items-center border-b border-tb-border px-2 pt-2">
        {(
          [
            { id: 'squad', label: 'Squad', icon: Users },
            { id: 'tactics', label: 'Tactics', icon: Layers },
            {
              id: 'style',
              label:
                selectedIds.length > 0 ? `Inspect (${selectedIds.length})` : 'Style',
              icon: Sliders,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 pb-2 text-xs font-semibold transition-colors ${
                active
                  ? 'border-emerald-500 text-emerald-500'
                  : 'border-transparent text-tb-muted hover:text-tb-text'
              }`}
            >
              <Icon size={13} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
          className="mb-1.5 ml-1 flex h-6 w-6 items-center justify-center rounded-md text-tb-muted hover:bg-tb-hover hover:text-tb-text lg:hidden"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'squad' && <SquadPanel />}
        {tab === 'tactics' && <TacticsPanel />}
        {tab === 'style' && <StyleInspectorPanel />}
      </div>
    </aside>
  );
}

function SquadPanel() {
  const project = useTacticalStore((s) => s.project);
  const clubs = useTacticalStore((s) => s.clubs);
  const getTeamRoster = useTacticalStore((s) => s.getTeamRoster);
  const setClub = useTacticalStore((s) => s.setClub);
  const setTeamVisible = useTacticalStore((s) => s.setTeamVisible);
  const setTeamColors = useTacticalStore((s) => s.setTeamColors);
  const addPlayerToPitch = useTacticalStore((s) => s.addPlayerToPitch);
  const removePlayerFromPitch = useTacticalStore((s) => s.removePlayerFromPitch);
  const addCustomPlayer = useTacticalStore((s) => s.addCustomPlayer);
  const deleteCustomPlayer = useTacticalStore((s) => s.deleteCustomPlayer);
  const selectOnly = useTacticalStore((s) => s.selectOnly);

  const [side, setSide] = useState<TeamSide>('home');
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<'ALL' | PlayerRoleGroup>('ALL');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customNum, setCustomNum] = useState('');
  const [customPos, setCustomPos] = useState<PlayerRoleGroup>('MF');

  const activeScene = useMemo(() => {
    if (!project) return null;
    return (
      project.scenes.find((s) => s.id === project.activeSceneId) ??
      project.scenes[0]
    );
  }, [project]);

  if (!project || !activeScene) return null;

  const team = project[side];
  const roster = getTeamRoster(side);
  const onPitchPlayers = activeScene.players.filter((p) => p.team === side);
  const onPitchRosterIds = new Set(
    onPitchPlayers.map((p) => p.rosterId).filter(Boolean) as string[],
  );

  const matchesFilter = (p: {
    name: string;
    number: string;
    pos: PlayerRoleGroup;
    subPos?: string | null;
  }) => {
    if (posFilter !== 'ALL' && p.pos !== posFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.number.toLowerCase().includes(q) ||
      (p.subPos?.toLowerCase().includes(q) ?? false)
    );
  };

  const benchRoster = roster.filter(
    (r) => !onPitchRosterIds.has(r.id) && matchesFilter(r),
  );
  const filteredPitch = onPitchPlayers.filter((p) =>
    matchesFilter({
      name: p.name,
      number: p.number,
      pos: p.pos,
      subPos: p.slotRole,
    }),
  );

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    addCustomPlayer(
      side,
      { name: customName.trim(), number: customNum.trim(), pos: customPos },
      true,
    );
    setCustomName('');
    setCustomNum('');
    setShowCustomForm(false);
  };

  const handleDragStart = (e: React.DragEvent, player: RosterPlayer) => {
    e.dataTransfer.setData(
      'application/x-tactical-player',
      JSON.stringify({ side, player }),
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Home / Away Switcher */}
      <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-tb-border bg-tb-input p-1">
        {(['home', 'away'] as TeamSide[]).map((t) => {
          const cfg = project[t];
          const active = side === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSide(t)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-tb-card text-tb-text shadow-xs ring-1 ring-tb-border'
                  : 'text-tb-muted hover:text-tb-text'
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/60"
                style={{ backgroundColor: cfg.primaryColor }}
              />
              <span className="truncate">
                {t === 'home' ? 'Home' : 'Away'} (
                {activeScene.players.filter((p) => p.team === t).length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Club Picker + Visibility + Kit Colors */}
      <div className="rounded-lg border border-tb-border bg-tb-card p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {team.logo && (
              <img
                src={`${BASE_PATH}${team.logo}`}
                alt=""
                width={18}
                height={18}
                className="h-4.5 w-4.5 shrink-0 object-contain"
              />
            )}
            <span className="truncate text-xs font-bold text-tb-text">
              {team.clubName}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTeamVisible(side, !team.visible)}
            title={team.visible ? 'Hide Team on Pitch' : 'Show Team on Pitch'}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
              team.visible
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-tb-input text-tb-muted'
            }`}
          >
            {team.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{team.visible ? 'Visible' : 'Hidden'}</span>
          </button>
        </div>

        <label className="block text-[10px] font-semibold tracking-wider text-tb-muted uppercase">
          Premier League Club (Real Squad Data)
        </label>
        <select
          value={team.clubSlug ?? ''}
          onChange={(e) => setClub(side, e.target.value)}
          className="mt-1 h-8 w-full rounded-md border border-tb-border bg-tb-input px-2 text-xs text-tb-text focus:border-emerald-500 focus:outline-none"
        >
          <optgroup label="2026-2027 Premier League">
            {clubs
              .filter((c) => c.isCurrentPl)
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="Historical PL Clubs (2014–2026)">
            {clubs
              .filter((c) => !c.isCurrentPl)
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.latestSeason})
                </option>
              ))}
          </optgroup>
        </select>

        {/* Kit Color Row */}
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-tb-muted">
          <label className="flex items-center gap-1.5">
            <span>Kit</span>
            <input
              type="color"
              value={team.primaryColor}
              onChange={(e) =>
                setTeamColors(side, { primaryColor: e.target.value })
              }
              className="h-5 w-6 cursor-pointer rounded border border-tb-border bg-transparent"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span>Num</span>
            <input
              type="color"
              value={team.secondaryColor}
              onChange={(e) =>
                setTeamColors(side, { secondaryColor: e.target.value })
              }
              className="h-5 w-6 cursor-pointer rounded border border-tb-border bg-transparent"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span>GK</span>
            <input
              type="color"
              value={team.gkColor}
              onChange={(e) =>
                setTeamColors(side, { gkColor: e.target.value })
              }
              className="h-5 w-6 cursor-pointer rounded border border-tb-border bg-transparent"
            />
          </label>
        </div>
      </div>

      {/* Search + Position Filter + Custom Player Button */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search
              size={13}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-tb-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, #, pos..."
              className="h-8 w-full rounded-md border border-tb-border bg-tb-input pl-8 pr-2 text-xs text-tb-text placeholder:text-tb-muted/70 focus:border-emerald-500/70 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowCustomForm((v) => !v)}
            title="Create Custom Player"
            className={`flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors ${
              showCustomForm
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-500'
                : 'border-tb-border bg-tb-card text-tb-text-2 hover:bg-tb-hover'
            }`}
          >
            <UserPlus size={13} />
            <span>Custom</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {POS_FILTERS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosFilter(pos)}
              className={`flex-1 rounded py-1 text-[10px] font-bold transition-colors ${
                posFilter === pos
                  ? 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40'
                  : 'bg-tb-card text-tb-muted hover:text-tb-text'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Inline Create Custom Player Form */}
      {showCustomForm && (
        <form
          onSubmit={handleCreateCustom}
          className="flex flex-col gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-2.5"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-sky-500">
            <span>New Custom Player</span>
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] uppercase">
              Tagged Custom
            </span>
          </div>
          <input
            type="text"
            required
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Player full name"
            className="h-7 rounded border border-tb-border bg-tb-input px-2 text-xs text-tb-text outline-none focus:border-sky-500"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              maxLength={3}
              value={customNum}
              onChange={(e) => setCustomNum(e.target.value)}
              placeholder="Shirt # (e.g. 10)"
              className="h-7 rounded border border-tb-border bg-tb-input px-2 text-xs text-tb-text outline-none focus:border-sky-500"
            />
            <select
              value={customPos}
              onChange={(e) => setCustomPos(e.target.value as PlayerRoleGroup)}
              className="h-7 rounded border border-tb-border bg-tb-input px-2 text-xs text-tb-text outline-none"
            >
              <option value="GK">GK</option>
              <option value="DF">DF</option>
              <option value="MF">MF</option>
              <option value="FW">FW</option>
            </select>
          </div>
          <button
            type="submit"
            className="h-7 rounded-md bg-sky-600 text-xs font-semibold text-white hover:bg-sky-500"
          >
            Add &amp; Place on Pitch
          </button>
        </form>
      )}

      {/* On Pitch XI List */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          <span>On Pitch ({onPitchPlayers.length})</span>
          <span className="font-normal">Click to inspect</span>
        </div>
        <div className="flex flex-col gap-1">
          {filteredPitch.map((p) => (
            <div
              key={p.id}
              onClick={() => selectOnly(p.id)}
              className="group flex cursor-pointer items-center justify-between gap-2 rounded-md border border-tb-border-subtle bg-tb-card px-2 py-1.5 text-xs hover:border-tb-border hover:bg-tb-hover"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                  style={{
                    backgroundColor: p.isGk ? team.gkColor : team.primaryColor,
                    color: p.isGk ? '#0f172a' : team.secondaryColor,
                  }}
                >
                  {p.number || '—'}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-tb-text">
                    {p.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-tb-muted">
                    <span>{p.slotRole}</span>
                    {p.source === 'custom' && (
                      <span className="rounded bg-sky-500/20 px-1 text-[9px] text-sky-500">
                        Custom
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePlayerFromPitch(p.id);
                }}
                title="Move to Bench"
                className="rounded p-1 text-tb-muted opacity-70 hover:bg-rose-500/20 hover:text-rose-500 group-hover:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Substitutes / Bench List (Draggable onto Pitch) */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          <span>Bench / Squad ({benchRoster.length})</span>
          <span className="font-normal text-emerald-500">Drag to pitch</span>
        </div>
        <div className="flex flex-col gap-1">
          {benchRoster.length === 0 ? (
            <div className="rounded-md border border-dashed border-tb-border py-4 text-center text-[11px] text-tb-muted">
              No matching bench players
            </div>
          ) : (
            benchRoster.map((r) => (
              <div
                key={r.id}
                draggable
                onDragStart={(e) => handleDragStart(e, r)}
                className="group flex cursor-grab items-center justify-between gap-2 rounded-md border border-tb-border-subtle bg-tb-input/70 px-2 py-1.5 text-xs hover:border-emerald-500/40 hover:bg-tb-hover active:cursor-grabbing"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <GripVertical
                    size={12}
                    className="shrink-0 text-tb-muted/70 group-hover:text-tb-text-2"
                  />
                  <span className="w-5 shrink-0 text-center font-mono text-[11px] font-bold text-tb-muted">
                    {r.number || '—'}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-tb-text">
                      {r.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-tb-muted">
                      <span className="font-semibold text-tb-text-2">
                        {r.subPos || r.pos}
                      </span>
                      {r.min != null && r.min > 0 && <span>{r.min}&apos;</span>}
                      {r.source === 'custom' && (
                        <span className="rounded bg-sky-500/20 px-1 text-[9px] text-sky-500">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => addPlayerToPitch(side, r)}
                    title="Place on Pitch"
                    className="rounded p-1 text-emerald-500 hover:bg-emerald-500/20"
                  >
                    <Plus size={13} />
                  </button>
                  {r.source === 'custom' && (
                    <button
                      type="button"
                      onClick={() => deleteCustomPlayer(side, r.id)}
                      title="Delete Custom Player"
                      className="rounded p-1 text-tb-muted hover:bg-rose-500/20 hover:text-rose-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TacticsPanel() {
  const project = useTacticalStore((s) => s.project);
  const setTeamFormation = useTacticalStore((s) => s.setTeamFormation);
  const applyTacticalPhasePreset = useTacticalStore(
    (s) => s.applyTacticalPhasePreset,
  );
  const setPitchConfig = useTacticalStore((s) => s.setPitchConfig);
  const showToast = useTacticalStore((s) => s.showToast);

  const [side, setSide] = useState<TeamSide>('home');
  const [customPresets, setCustomPresets] = useState<CustomFormationPreset[]>(
    () => loadCustomFormations(),
  );
  const [customName, setCustomName] = useState('');

  if (!project) return null;

  const activeScene =
    project.scenes.find((s) => s.id === project.activeSceneId) ??
    project.scenes[0];
  const currentFormation = project[side].formation;

  const handleSaveCustomFormation = () => {
    const teamPlayers = activeScene.players.filter((p) => p.team === side);
    if (teamPlayers.length === 0) return;
    const name = customName.trim() || `Custom ${customPresets.length + 1}`;
    const slots = teamPlayers.slice(0, 11).map((p) => ({
      role: p.slotRole,
      group: p.pos,
      x: side === 'home' ? p.x : 1050 - p.x,
      y: side === 'home' ? p.y : 680 - p.y,
    }));
    const updated = saveCustomFormation({
      id: `cf-${Date.now()}`,
      name,
      slots,
    });
    setCustomPresets(updated);
    setCustomName('');
    showToast(`Saved custom formation "${name}"`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Team Toggle for Formation / Tactical Phase */}
      <div>
        <div className="mb-1.5 text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          Apply Formation / Phase To
        </div>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-tb-border bg-tb-input p-1">
          {(['home', 'away'] as TeamSide[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSide(t)}
              className={`truncate rounded-md px-2 py-1 text-xs font-semibold ${
                side === t
                  ? 'bg-tb-card text-tb-text shadow-xs ring-1 ring-tb-border'
                  : 'text-tb-muted hover:text-tb-text'
              }`}
            >
              {t === 'home' ? project.home.clubName : project.away.clubName}
            </button>
          ))}
        </div>
      </div>

      {/* Base Formation Grid */}
      <div>
        <div className="mb-1.5 text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          Base Formations
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {FORMATIONS.map((f) => {
            const active = currentFormation === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setTeamFormation(side, f.id)}
                title={f.description}
                className={`rounded-lg border px-2 py-2 text-center text-xs font-bold transition-all ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-500'
                    : 'border-tb-border bg-tb-card text-tb-text-2 hover:bg-tb-hover hover:text-tb-text'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modern Tactical Phase Presets (Juego de Posición / Rest-Defense / Pressing) */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          <Compass size={12} className="text-sky-500" />
          <span>Positional Play &amp; Phase Presets</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {TACTICAL_PHASE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyTacticalPhasePreset(side, preset.id)}
              title={preset.description}
              className="flex flex-col rounded-lg border border-tb-border bg-tb-card px-2.5 py-2 text-left transition-colors hover:border-sky-500/60 hover:bg-sky-500/10"
            >
              <span className="text-xs font-bold text-tb-text">
                {preset.label}
              </span>
              <span className="text-[10px] font-medium text-sky-500">
                {preset.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tactical Zone Overlays (Half-Spaces, Pep 20-Zone, Zone 14, Pressing Traps) */}
      <div>
        <div className="mb-1.5 text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          Tactical Zone Grids &amp; Half-Spaces
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: 'none', label: 'Off' },
              { id: 'channels', label: '5 Channels / Half-Spaces' },
              { id: 'jdp-20', label: 'Pep 20-Zone (JdP)' },
              { id: 'zone-14', label: 'Zone 14 & Traps' },
              { id: 'grid-18', label: '18-Zone + Zone 14' },
              { id: 'thirds', label: 'Pitch Thirds' },
            ] as { id: ZoneOverlay; label: string }[]
          ).map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setPitchConfig({ zoneOverlay: z.id })}
              className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                project.pitch.zoneOverlay === z.id
                  ? 'border-sky-500/70 bg-sky-500/15 text-sky-500'
                  : 'border-tb-border bg-tb-card text-tb-text-2 hover:bg-tb-hover hover:text-tb-text'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Formations */}
      <div className="rounded-lg border border-tb-border bg-tb-card p-2.5">
        <div className="mb-1.5 text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          Custom Formations
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Save current shape as..."
            className="h-7 flex-1 rounded border border-tb-border bg-tb-input px-2 text-xs text-tb-text outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={handleSaveCustomFormation}
            className="rounded bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Save
          </button>
        </div>
        {customPresets.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {customPresets.map((cp) => (
              <div
                key={cp.id}
                className="flex items-center justify-between rounded border border-tb-border-subtle bg-tb-input px-2 py-1 text-xs"
              >
                <button
                  type="button"
                  onClick={() => setTeamFormation(side, 'custom', cp.slots)}
                  className="flex-1 text-left font-medium text-tb-text hover:text-emerald-500"
                >
                  {cp.name}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPresets(deleteCustomFormation(cp.id))}
                  className="p-0.5 text-tb-muted hover:text-rose-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pitch View & Orientation */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          Pitch View &amp; Orientation
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: 'full', label: 'Full' },
              { id: 'half-left', label: 'Left Half' },
              { id: 'half-right', label: 'Right Half' },
            ] as { id: PitchView; label: string }[]
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setPitchConfig({ view: v.id })}
              className={`rounded-md border py-1.5 text-xs font-semibold ${
                project.pitch.view === v.id
                  ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-500'
                  : 'border-tb-border bg-tb-card text-tb-muted hover:text-tb-text'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          {(['horizontal', 'vertical'] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setPitchConfig({ orientation: o })}
              className={`rounded-md border py-1.5 text-xs font-semibold capitalize ${
                project.pitch.orientation === o
                  ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-500'
                  : 'border-tb-border bg-tb-card text-tb-muted hover:text-tb-text'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Pitch Surface Theme */}
      <div>
        <div className="mb-1.5 text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          Pitch Surface
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: 'emerald', label: 'Emerald Turf', dot: '#166534' },
              { id: 'dark-slate', label: 'Dark Analytics', dot: '#131d2b' },
              { id: 'blueprint', label: 'Tactical Blue', dot: '#102442' },
              { id: 'broadcast', label: 'Broadcast TV', dot: '#1f773c' },
              { id: 'light-tactical', label: 'Light Tactical', dot: '#e8f1ec' },
            ] as { id: PitchTheme; label: string; dot: string }[]
          ).map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => setPitchConfig({ theme: th.id })}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium ${
                project.pitch.theme === th.id
                  ? 'border-emerald-500 bg-emerald-500/15 text-tb-text'
                  : 'border-tb-border bg-tb-card text-tb-muted hover:text-tb-text'
              }`}
            >
              <span
                className="h-3 w-3 rounded-full border border-tb-border"
                style={{ backgroundColor: th.dot }}
              />
              <span className="truncate">{th.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Player Token Display Controls */}
      <div className="rounded-lg border border-tb-border bg-tb-card p-2.5">
        <div className="mb-2 text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          Display &amp; Token Size
        </div>
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-tb-muted">
            <span>Player Token Size</span>
            <span className="font-mono text-tb-text">
              {Math.round(project.pitch.playerSize * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.7}
            max={1.45}
            step={0.05}
            value={project.pitch.playerSize}
            onChange={(e) =>
              setPitchConfig({ playerSize: parseFloat(e.target.value) })
            }
            className="h-1.5 w-full cursor-pointer accent-emerald-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {(
            [
              { key: 'showNames', label: 'Names' },
              { key: 'showNumbers', label: 'Numbers' },
              { key: 'showRoles', label: 'Role Badges' },
              { key: 'showTrails', label: 'Motion Trails' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.key}
              className="flex cursor-pointer items-center justify-between rounded-md border border-tb-border-subtle bg-tb-input px-2 py-1.5"
            >
              <span className="text-[11px] text-tb-text-2">{opt.label}</span>
              <input
                type="checkbox"
                checked={project.pitch[opt.key]}
                onChange={(e) =>
                  setPitchConfig({ [opt.key]: e.target.checked })
                }
                className="accent-emerald-500"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function StyleInspectorPanel() {
  const project = useTacticalStore((s) => s.project);
  const drawStyle = useTacticalStore((s) => s.drawStyle);
  const selectedIds = useTacticalStore((s) => s.selectedIds);

  const setDrawStyle = useTacticalStore((s) => s.setDrawStyle);
  const updateSelectedDrawingsStyle = useTacticalStore(
    (s) => s.updateSelectedDrawingsStyle,
  );
  const updateBoardPlayer = useTacticalStore((s) => s.updateBoardPlayer);
  const removePlayerFromPitch = useTacticalStore(
    (s) => s.removePlayerFromPitch,
  );
  const updateDrawing = useTacticalStore((s) => s.updateDrawing);
  const deleteSelected = useTacticalStore((s) => s.deleteSelected);

  if (!project) return null;
  const activeScene =
    project.scenes.find((s) => s.id === project.activeSceneId) ??
    project.scenes[0];

  const selectedPlayers = activeScene.players.filter((p) =>
    selectedIds.includes(p.id),
  );
  const selectedDrawings = activeScene.drawings.filter((d) =>
    selectedIds.includes(d.id),
  );
  const singlePlayer =
    selectedIds.length === 1 && selectedPlayers.length === 1
      ? selectedPlayers[0]
      : null;
  const singleText =
    selectedIds.length === 1 &&
    selectedDrawings.length === 1 &&
    selectedDrawings[0].type === 'text'
      ? selectedDrawings[0]
      : null;

  const applyStyle = (patch: Partial<typeof drawStyle>) => {
    setDrawStyle(patch);
    if (selectedDrawings.length > 0) {
      updateSelectedDrawingsStyle(patch);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Contextual Selection Inspector */}
      {selectedIds.length > 0 && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-sky-500 uppercase">
              {singlePlayer
                ? 'Selected Player'
                : `${selectedIds.length} Selected`}
            </span>
            <button
              type="button"
              onClick={deleteSelected}
              className="flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/30"
            >
              <Trash2 size={11} />
              <span>Delete</span>
            </button>
          </div>

          {singlePlayer && (
            <div className="flex flex-col gap-2 text-xs">
              <div>
                <label className="text-[10px] text-tb-muted">Display Name</label>
                <input
                  type="text"
                  value={singlePlayer.shortName}
                  onChange={(e) =>
                    updateBoardPlayer(singlePlayer.id, {
                      shortName: e.target.value,
                    })
                  }
                  className="mt-0.5 h-7 w-full rounded border border-tb-border bg-tb-input px-2 text-xs text-tb-text outline-none focus:border-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-tb-muted">Shirt #</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={singlePlayer.number}
                    onChange={(e) =>
                      updateBoardPlayer(singlePlayer.id, {
                        number: e.target.value,
                      })
                    }
                    className="mt-0.5 h-7 w-full rounded border border-tb-border bg-tb-input px-2 text-xs text-tb-text outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-tb-muted">Role</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={singlePlayer.slotRole}
                    onChange={(e) =>
                      updateBoardPlayer(singlePlayer.id, {
                        slotRole: e.target.value.toUpperCase(),
                      })
                    }
                    className="mt-0.5 h-7 w-full rounded border border-tb-border bg-tb-input px-2 text-xs text-tb-text outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-tb-muted">
                  <span>Individual Size</span>
                  <span>{Math.round(singlePlayer.size * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={singlePlayer.size}
                  onChange={(e) =>
                    updateBoardPlayer(singlePlayer.id, {
                      size: parseFloat(e.target.value),
                    })
                  }
                  className="h-1.5 w-full cursor-pointer accent-sky-500"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-tb-text-2">
                  <span>Custom Color</span>
                  <input
                    type="color"
                    value={
                      singlePlayer.customColor ??
                      project[singlePlayer.team].primaryColor
                    }
                    onChange={(e) =>
                      updateBoardPlayer(singlePlayer.id, {
                        customColor: e.target.value,
                      })
                    }
                    className="h-5 w-6 cursor-pointer rounded border border-tb-border bg-transparent"
                  />
                </label>
                {singlePlayer.customColor && (
                  <button
                    type="button"
                    onClick={() =>
                      updateBoardPlayer(singlePlayer.id, {
                        customColor: undefined,
                      })
                    }
                    className="text-[10px] text-tb-muted underline hover:text-tb-text"
                  >
                    Reset color
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => removePlayerFromPitch(singlePlayer.id)}
                className="mt-1 rounded border border-tb-border bg-tb-card py-1 text-[11px] font-medium text-tb-text-2 hover:border-rose-500/50 hover:text-rose-500"
              >
                Move to Bench
              </button>
            </div>
          )}

          {singleText && (
            <div className="flex flex-col gap-2 text-xs">
              <label className="text-[10px] text-tb-muted">Annotation Text</label>
              <input
                type="text"
                value={singleText.text}
                onChange={(e) =>
                  updateDrawing(singleText.id, { text: e.target.value })
                }
                className="h-7 w-full rounded border border-tb-border bg-tb-input px-2 text-xs text-tb-text outline-none focus:border-sky-500"
              />
            </div>
          )}

          {!singlePlayer && !singleText && (
            <p className="text-[11px] text-tb-text-2">
              Drag any selected object on the pitch to move all{' '}
              {selectedIds.length} items together, or adjust drawing colors
              below.
            </p>
          )}
        </div>
      )}

      {/* Drawing Tool Style Controls */}
      <div className="rounded-lg border border-tb-border bg-tb-card p-3">
        <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-tb-muted uppercase">
          <Palette size={12} />
          <span>Drawing Tool Style</span>
        </div>

        {/* Color Swatches + Custom Color Picker */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {QUICK_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => applyStyle({ color: col })}
              className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                drawStyle.color.toLowerCase() === col.toLowerCase()
                  ? 'scale-110 border-tb-text ring-2 ring-emerald-500'
                  : 'border-tb-border'
              }`}
              style={{ backgroundColor: col }}
            />
          ))}
          <input
            type="color"
            value={drawStyle.color}
            onChange={(e) => applyStyle({ color: e.target.value })}
            title="Custom Color"
            className="h-6 w-7 cursor-pointer rounded border border-tb-border bg-transparent"
          />
        </div>

        {/* Stroke Width */}
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-tb-muted">
            <span>Stroke Width</span>
            <span className="font-mono text-tb-text">
              {drawStyle.strokeWidth.toFixed(1)} px
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={drawStyle.strokeWidth}
            onChange={(e) =>
              applyStyle({ strokeWidth: parseFloat(e.target.value) })
            }
            className="h-1.5 w-full cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Opacity */}
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-tb-muted">
            <span>Opacity</span>
            <span className="font-mono text-tb-text">
              {Math.round(drawStyle.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={drawStyle.opacity}
            onChange={(e) =>
              applyStyle({ opacity: parseFloat(e.target.value) })
            }
            className="h-1.5 w-full cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Zone / Shape Fill Opacity */}
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-tb-muted">
            <span>Shape Fill Opacity</span>
            <span className="font-mono text-tb-text">
              {Math.round(drawStyle.fillOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.7}
            step={0.04}
            value={drawStyle.fillOpacity}
            onChange={(e) =>
              applyStyle({ fillOpacity: parseFloat(e.target.value) })
            }
            className="h-1.5 w-full cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Text Font Size */}
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-tb-muted">
            <span>Text Size</span>
            <span className="font-mono text-tb-text">
              {drawStyle.fontSize} px
            </span>
          </div>
          <input
            type="range"
            min={11}
            max={34}
            step={1}
            value={drawStyle.fontSize}
            onChange={(e) =>
              applyStyle({ fontSize: parseInt(e.target.value, 10) })
            }
            className="h-1.5 w-full cursor-pointer accent-emerald-500"
          />
        </div>
      </div>

      {/* Shortcuts Cheat Sheet */}
      <div className="rounded-lg border border-tb-border-subtle bg-tb-input/70 p-2.5 text-[11px] text-tb-muted">
        <div className="mb-1.5 text-[10px] font-bold tracking-wider uppercase">
          Pro Shortcuts
        </div>
        <div className="grid grid-cols-2 gap-y-1">
          <span>V — Select / Box</span>
          <span>Space — Play/Pause</span>
          <span>A / D / C — Arrows</span>
          <span>Ctrl+Z / Y — Undo</span>
          <span>F — Fullscreen</span>
          <span>Arrows — Nudge</span>
          <span>Shift+Click — Multi</span>
          <span>Del — Delete</span>
          <span>Ctrl+S — Save</span>
          <span>Ctrl+D — Dup Scene</span>
        </div>
      </div>
    </div>
  );
}

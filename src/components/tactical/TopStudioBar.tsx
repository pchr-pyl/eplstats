'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  FileCode2,
  FileJson,
  Film,
  FolderOpen,
  Grid3X3,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Moon,
  PanelRight,
  Presentation,
  RotateCcw,
  RotateCw,
  Save,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import {
  exportAnimationWebm,
  exportPitchPng,
  exportPitchSvg,
  exportPresentationPng,
  exportProjectJson,
} from '@/lib/tactical/export';
import { useTacticalStore } from '@/lib/tactical/store';
import type { PitchView, ZoneOverlay } from '@/lib/tactical/types';

const ZONE_OPTIONS: {
  id: ZoneOverlay;
  short: string;
  label: string;
  desc: string;
}[] = [
  { id: 'none', short: 'Zones: Off', label: 'Off', desc: 'Clean pitch without zone lines' },
  { id: 'channels', short: '5 Channels', label: '5 Vertical Channels', desc: 'Flanks, Left/Right Half-Spaces & Center' },
  { id: 'jdp-20', short: 'Pep 20-Zone', label: 'Juego de Posición (20-Zone)', desc: '5 Channels × 4 Horizontal Zones + Zone 14' },
  { id: 'zone-14', short: 'Zone 14 & Traps', label: 'Zone 14 & Pressing Traps', desc: 'Golden Zone 14, Z13/Z15 Half-Spaces & Wide Traps' },
  { id: 'grid-18', short: '18-Zone + Z14', label: '18-Zone Grid (Z14)', desc: 'Standard 6×3 analytical grid highlighting Zone 14' },
  { id: 'thirds', short: 'Thirds', label: 'Pitch Thirds', desc: 'Defensive, Middle & Final Third' },
];

export function TopStudioBar({
  svgRef,
  sidebarOpen,
  isFullscreen,
  onToggleFullscreen,
  onToggleSidebar,
  onOpenProjects,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  sidebarOpen: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onToggleSidebar: () => void;
  onOpenProjects: () => void;
}) {
  const { theme, toggle: toggleGlobalTheme } = useTheme();
  const project = useTacticalStore((s) => s.project);
  const isDirty = useTacticalStore((s) => s.isDirty);
  const playbackSpeed = useTacticalStore((s) => s.playbackSpeed);

  const renameProject = useTacticalStore((s) => s.renameProject);
  const saveCurrentProject = useTacticalStore((s) => s.saveCurrentProject);
  const setPitchConfig = useTacticalStore((s) => s.setPitchConfig);
  const loadHalfSpaceDemo = useTacticalStore((s) => s.loadHalfSpaceDemo);
  const clearDrawings = useTacticalStore((s) => s.clearDrawings);
  const resetBoard = useTacticalStore((s) => s.resetBoard);
  const setPlayhead = useTacticalStore((s) => s.setPlayhead);
  const showToast = useTacticalStore((s) => s.showToast);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen && !zoneOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
      if (zoneRef.current && !zoneRef.current.contains(e.target as Node)) {
        setZoneOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [exportOpen, zoneOpen]);

  if (!project) return null;

  const activeSceneIdx = Math.max(
    0,
    project.scenes.findIndex((s) => s.id === project.activeSceneId),
  );
  const activeScene = project.scenes[activeSceneIdx] ?? project.scenes[0];

  const handleExportPng = async () => {
    if (!svgRef.current) return;
    setExportOpen(false);
    setExportBusy('PNG...');
    try {
      await exportPitchPng(svgRef.current, project.name, activeScene.name, 2);
      showToast('Exported High-Res Pitch PNG');
    } catch {
      showToast('Failed to export PNG');
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportSlide = async () => {
    if (!svgRef.current) return;
    setExportOpen(false);
    setExportBusy('Slide...');
    try {
      await exportPresentationPng(
        svgRef.current,
        project,
        activeScene,
        activeSceneIdx,
      );
      showToast('Exported 1920x1080 Presentation Slide PNG');
    } catch {
      showToast('Failed to export Presentation Slide');
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    setExportOpen(false);
    exportPitchSvg(svgRef.current, project.name, activeScene.name);
    showToast('Exported Full Pitch SVG');
  };

  const handleExportJson = () => {
    setExportOpen(false);
    exportProjectJson(project);
    showToast('Exported Project JSON');
  };

  const handleExportVideo = async () => {
    setExportOpen(false);
    setExportBusy('Video 0%');
    try {
      await exportAnimationWebm({
        getSvg: () => svgRef.current,
        sceneCount: project.scenes.length,
        speed: playbackSpeed,
        projectName: project.name,
        setPlayhead,
        onProgress: (pct) => setExportBusy(`Video ${pct}%`),
      });
      showToast('Exported Animation Video (WebM)');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Video export failed');
    } finally {
      setExportBusy(null);
    }
  };

  const currentZone =
    ZONE_OPTIONS.find((z) => z.id === project.pitch.zoneOverlay) ??
    ZONE_OPTIONS[0];

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-tb-border bg-tb-bar px-2.5 text-tb-text sm:px-3.5">
      {/* Left: Back + Brand + Editable Project Title */}
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/"
          title="Back to EPL Stats Dashboard"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-tb-border bg-tb-card text-tb-text-2 transition-colors hover:bg-tb-hover hover:text-tb-text"
        >
          <ArrowLeft size={15} />
        </Link>

        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 text-[11px] font-black text-emerald-500 ring-1 ring-emerald-500/40">
            TB
          </span>
          <span className="text-xs font-bold tracking-wider text-tb-muted uppercase">
            Tactical Studio
          </span>
          <span className="text-tb-border">/</span>
        </div>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              renameProject(titleDraft);
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                renameProject(titleDraft);
                setEditingTitle(false);
              }
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            className="w-40 rounded-md border border-emerald-500/70 bg-tb-input px-2 py-1 text-sm font-semibold text-tb-text outline-none sm:w-52"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(project.name);
              setEditingTitle(true);
            }}
            title="Click to rename project"
            className="max-w-[125px] truncate rounded-md px-1.5 py-1 text-left text-sm font-semibold text-tb-text transition-colors hover:bg-tb-hover sm:max-w-[190px]"
          >
            {project.name}
          </button>
        )}

        <button
          type="button"
          onClick={() => void saveCurrentProject(false)}
          title="Save Project (Ctrl+S)"
          className={`flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors ${
            isDirty
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25'
              : 'border-tb-border bg-tb-card text-tb-muted hover:text-tb-text'
          }`}
        >
          {isDirty ? (
            <Save size={13} />
          ) : (
            <Check size={13} className="text-emerald-500" />
          )}
          <span className="hidden md:inline">{isDirty ? 'Save' : 'Saved'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenProjects}
          title="Open / Manage Projects & JSON Import"
          className="flex h-7 items-center gap-1 rounded-md border border-tb-border bg-tb-card px-2 text-xs font-medium text-tb-text-2 transition-colors hover:bg-tb-hover hover:text-tb-text"
        >
          <FolderOpen size={13} />
          <span className="hidden md:inline">Projects</span>
        </button>
      </div>

      {/* Center: Pitch View & Orientation & Zone Overlay Picker */}
      <div className="hidden items-center gap-1.5 xl:flex">
        <div className="flex items-center rounded-lg border border-tb-border bg-tb-input p-0.5 text-xs">
          {(
            [
              { id: 'full', label: 'Full Pitch' },
              { id: 'half-left', label: 'Left Half' },
              { id: 'half-right', label: 'Right Half' },
            ] as { id: PitchView; label: string }[]
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setPitchConfig({ view: v.id })}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                project.pitch.view === v.id
                  ? 'bg-tb-accent-soft text-tb-accent font-semibold'
                  : 'text-tb-muted hover:text-tb-text'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setPitchConfig({
              orientation:
                project.pitch.orientation === 'horizontal'
                  ? 'vertical'
                  : 'horizontal',
            })
          }
          title="Toggle Horizontal / Vertical Pitch"
          className="flex h-7 items-center gap-1.5 rounded-lg border border-tb-border bg-tb-card px-2.5 text-xs font-medium text-tb-text-2 hover:bg-tb-hover hover:text-tb-text"
        >
          <RotateCw size={13} />
          <span>
            {project.pitch.orientation === 'horizontal'
              ? 'Horizontal'
              : 'Vertical'}
          </span>
        </button>

        {/* Zones Dropdown */}
        <div ref={zoneRef} className="relative">
          <button
            type="button"
            onClick={() => setZoneOpen((o) => !o)}
            title="Select Tactical Zone Overlay (Half-Spaces, Zone 14, Pep 20-Zone)"
            className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
              project.pitch.zoneOverlay !== 'none'
                ? 'border-tb-info/50 bg-tb-info-soft text-tb-info'
                : 'border-tb-border bg-tb-card text-tb-muted hover:text-tb-text'
            }`}
          >
            <Grid3X3 size={13} />
            <span>{currentZone.short}</span>
          </button>

          {zoneOpen && (
            <div className="absolute left-0 z-[90] mt-1.5 w-64 rounded-xl border border-tb-border bg-tb-card p-1.5 shadow-2xl">
              {ZONE_OPTIONS.map((z) => {
                const active = project.pitch.zoneOverlay === z.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => {
                      setPitchConfig({ zoneOverlay: z.id });
                      setZoneOpen(false);
                    }}
                    className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors ${
                      active
                        ? 'bg-tb-info-soft text-tb-info'
                        : 'text-tb-text hover:bg-tb-hover'
                    }`}
                  >
                    <span className="text-xs font-semibold">{z.label}</span>
                    <span className="text-[10px] text-tb-muted">{z.desc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Demo + Clear + Reset + Fullscreen + Theme + Export + Sidebar */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={loadHalfSpaceDemo}
          title="Load 4-Scene 4-3-3 Half-Space Attack Progression Demo"
          className="hidden h-7 items-center gap-1.5 rounded-lg border border-tb-info/40 bg-tb-info-soft px-2.5 text-xs font-semibold text-tb-info transition-colors hover:opacity-90 sm:flex"
        >
          <Sparkles size={13} />
          <span className="hidden lg:inline">4-Scene Demo</span>
        </button>

        <button
          type="button"
          onClick={clearDrawings}
          title="Clear All Drawings in Active Scene"
          className="hidden h-7 items-center gap-1 rounded-lg border border-tb-border bg-tb-card px-2 text-xs text-tb-muted hover:bg-tb-hover hover:text-rose-500 md:flex"
        >
          <Trash2 size={13} />
          <span className="hidden 2xl:inline">Clear</span>
        </button>

        <button
          type="button"
          onClick={resetBoard}
          title="Reset Players & Board to Team Formations"
          className="hidden h-7 items-center gap-1 rounded-lg border border-tb-border bg-tb-card px-2 text-xs text-tb-muted hover:bg-tb-hover hover:text-tb-text md:flex"
        >
          <RotateCcw size={13} />
          <span className="hidden 2xl:inline">Reset</span>
        </button>

        {/* Fullscreen Mode Button */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen (F / Esc)' : 'Fullscreen Mode (F)'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
          className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors ${
            isFullscreen
              ? 'border-tb-accent/60 bg-tb-accent-soft text-tb-accent'
              : 'border-tb-border bg-tb-card text-tb-text-2 hover:bg-tb-hover hover:text-tb-text'
          }`}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span className="hidden xl:inline">
            {isFullscreen ? 'Exit' : 'Full'}
          </span>
        </button>

        {/* Light / Dark Mode Toggle (Synced with Site Global Theme) */}
        <button
          type="button"
          onClick={toggleGlobalTheme}
          title={
            theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
          }
          aria-label={
            theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-tb-border bg-tb-card text-tb-text-2 transition-colors hover:bg-tb-hover hover:text-tb-text"
        >
          {theme === 'dark' ? (
            <Sun size={15} className="text-amber-400" />
          ) : (
            <Moon size={15} className="text-slate-700" />
          )}
        </button>

        {/* Export Dropdown */}
        <div ref={exportRef} className="relative">
          <button
            type="button"
            onClick={() => setExportOpen((o) => !o)}
            disabled={Boolean(exportBusy)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            <Download size={14} />
            <span>{exportBusy ?? 'Export'}</span>
          </button>

          {exportOpen && (
            <div className="absolute right-0 z-[90] mt-1.5 w-60 rounded-xl border border-tb-border bg-tb-card p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => void handleExportPng()}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-tb-text hover:bg-tb-hover"
              >
                <ImageIcon size={15} className="text-emerald-500" />
                <div>
                  <div>Full Pitch PNG (2x)</div>
                  <div className="text-[10px] text-tb-muted">
                    Clean high-res tactical board
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void handleExportSlide()}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-tb-text hover:bg-tb-hover"
              >
                <Presentation size={15} className="text-sky-500" />
                <div>
                  <div>Presentation Slide (16:9)</div>
                  <div className="text-[10px] text-tb-muted">
                    1920x1080 with title &amp; notes
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={handleExportSvg}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-tb-text hover:bg-tb-hover"
              >
                <FileCode2 size={15} className="text-amber-500" />
                <div>
                  <div>Full Pitch SVG</div>
                  <div className="text-[10px] text-tb-muted">
                    Scalable vector graphic
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-tb-text hover:bg-tb-hover"
              >
                <FileJson size={15} className="text-violet-500" />
                <div>
                  <div>Project JSON</div>
                  <div className="text-[10px] text-tb-muted">
                    Full editable backup file
                  </div>
                </div>
              </button>
              <div className="my-1 h-px bg-tb-border" />
              <button
                type="button"
                onClick={() => void handleExportVideo()}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-tb-text hover:bg-tb-hover"
              >
                <Film size={15} className="text-rose-500" />
                <div>
                  <div>Animation Video (WebM)</div>
                  <div className="text-[10px] text-tb-muted">
                    Record multi-scene playback
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleSidebar}
          title={
            sidebarOpen ? 'Hide Inspector Sidebar' : 'Show Inspector Sidebar'
          }
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
            sidebarOpen
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-500'
              : 'border-tb-border bg-tb-card text-tb-muted hover:text-tb-text'
          }`}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
}

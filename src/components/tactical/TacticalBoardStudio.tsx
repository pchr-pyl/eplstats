'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useTacticalStore } from '@/lib/tactical/store';
import type { TacticalBootstrapData } from '@/lib/tactical/types';
import { ProjectModal } from './ProjectModal';
import { RightSidebar, type SidebarTab } from './RightSidebar';
import { SceneTimeline } from './SceneTimeline';
import { TacticalCanvas } from './TacticalCanvas';
import { TACTICAL_TOOLS, ToolDock } from './ToolDock';
import { TopStudioBar } from './TopStudioBar';

export function TacticalBoardStudio({
  bootstrap,
  initialHomeSlug,
  initialAwaySlug,
}: {
  bootstrap: TacticalBootstrapData;
  initialHomeSlug?: string;
  initialAwaySlug?: string;
}) {
  const { theme } = useTheme();
  const initialized = useTacticalStore((s) => s.initialized);
  const project = useTacticalStore((s) => s.project);
  const isDirty = useTacticalStore((s) => s.isDirty);
  const isPlaying = useTacticalStore((s) => s.isPlaying);
  const toast = useTacticalStore((s) => s.toast);

  const init = useTacticalStore((s) => s.init);
  const saveCurrentProject = useTacticalStore((s) => s.saveCurrentProject);
  const setTool = useTacticalStore((s) => s.setTool);
  const undo = useTacticalStore((s) => s.undo);
  const redo = useTacticalStore((s) => s.redo);
  const deleteSelected = useTacticalStore((s) => s.deleteSelected);
  const clearSelection = useTacticalStore((s) => s.clearSelection);
  const togglePlaying = useTacticalStore((s) => s.togglePlaying);
  const moveSelectedBy = useTacticalStore((s) => s.moveSelectedBy);
  const captureHistory = useTacticalStore((s) => s.captureHistory);
  const showToast = useTacticalStore((s) => s.showToast);

  const studioRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('squad');
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        if (next && studioRef.current?.requestFullscreen) {
          studioRef.current.requestFullscreen().catch(() => {
            // Fallback: fixed viewport fullscreen overlay still works cleanly
          });
        } else if (!next && document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Keep state in sync if user exits native browser fullscreen via Esc
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Initialize store with real EPL bootstrap data & IndexedDB restore
  useEffect(() => {
    void init(bootstrap, {
      homeSlug: initialHomeSlug,
      awaySlug: initialAwaySlug,
    });
  }, [init, bootstrap, initialHomeSlug, initialAwaySlug]);

  // Default sidebar closed on narrow mobile viewports so pitch gets full screen
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      queueMicrotask(() => setSidebarOpen(false));
    }
  }, []);

  // Debounced auto-save to IndexedDB
  useEffect(() => {
    if (!initialized || !isDirty || !project) return;
    const t = setTimeout(() => {
      void saveCurrentProject(true);
    }, 1400);
    return () => clearTimeout(t);
  }, [initialized, isDirty, project, saveCurrentProject]);

  // Smooth 60fps requestAnimationFrame scene interpolation loop
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(80, now - lastTs);
      lastTs = now;

      const state = useTacticalStore.getState();
      if (!state.isPlaying || !state.project) return;
      const scenes = state.project.scenes;
      if (scenes.length < 2) {
        state.setPlaying(false);
        return;
      }

      const maxPos = scenes.length - 1;
      const curIdx = Math.min(maxPos - 1, Math.floor(state.playhead));
      const dur = Math.max(400, scenes[curIdx]?.durationMs ?? 1600);
      const step = (dt / dur) * state.playbackSpeed;
      const next = state.playhead + step;

      if (next >= maxPos) {
        if (state.loop) {
          state.setPlayhead(0);
          rafId = requestAnimationFrame(tick);
        } else {
          state.setPlayhead(maxPos);
          state.setPlaying(false);
        }
        return;
      }

      state.setPlayhead(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Global Studio Keyboard Shortcuts (uses physical e.code so Thai & English keyboards BOTH work!)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const mod = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd shortcuts (work on Thai AND English keyboard layouts via e.code!)
      if (mod) {
        if (e.code === 'KeyS') {
          e.preventDefault();
          void saveCurrentProject(false);
          return;
        }
        if (!isEditing && e.code === 'KeyZ') {
          e.preventDefault();
          const st = useTacticalStore.getState();
          if (e.shiftKey) {
            if (st.future.length > 0) {
              redo();
              showToast('Redo (Ctrl+Shift+Z)');
            }
          } else if (st.past.length > 0) {
            undo();
            showToast('Undo (Ctrl+Z)');
          }
          return;
        }
        if (!isEditing && e.code === 'KeyY') {
          e.preventDefault();
          if (useTacticalStore.getState().future.length > 0) {
            redo();
            showToast('Redo (Ctrl+Y)');
          }
          return;
        }
        if (!isEditing && e.code === 'KeyD') {
          e.preventDefault();
          const st = useTacticalStore.getState();
          if (st.project) {
            st.duplicateScene(st.project.activeSceneId);
            showToast('Duplicated Scene (Ctrl+D)');
          }
          return;
        }
        return;
      }

      if (isEditing) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlaying();
        return;
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.code === 'Escape') {
        if (isFullscreen) {
          toggleFullscreen();
          return;
        }
        clearSelection();
        setTool('select');
        return;
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Arrow keys: nudge selected players/drawings, or step scenes when nothing selected
      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        const st = useTacticalStore.getState();
        if (st.selectedIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 18 : 6;
          const isVert = st.project?.pitch.orientation === 'vertical';
          let dx = 0;
          let dy = 0;
          if (!isVert) {
            if (e.code === 'ArrowLeft') dx = -step;
            if (e.code === 'ArrowRight') dx = step;
            if (e.code === 'ArrowUp') dy = -step;
            if (e.code === 'ArrowDown') dy = step;
          } else {
            if (e.code === 'ArrowUp') dx = step;
            if (e.code === 'ArrowDown') dx = -step;
            if (e.code === 'ArrowLeft') dy = -step;
            if (e.code === 'ArrowRight') dy = step;
          }
          captureHistory();
          moveSelectedBy(dx, dy);
          return;
        } else if (st.project && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
          const idx = st.project.scenes.findIndex(
            (sc) => sc.id === st.project!.activeSceneId,
          );
          if (idx >= 0) {
            const nextIdx =
              e.code === 'ArrowLeft'
                ? Math.max(0, idx - 1)
                : Math.min(st.project.scenes.length - 1, idx + 1);
            if (nextIdx !== idx) {
              e.preventDefault();
              st.selectScene(st.project.scenes[nextIdx].id);
            }
          }
          return;
        }
      }

      // Tool single-key shortcuts mapped by physical KeyX code (Thai + English layout safe!)
      if (e.code.startsWith('Key') && e.code.length === 4) {
        const letter = e.code.slice(3);
        const matched = TACTICAL_TOOLS.find((t) => t.shortcut === letter);
        if (matched) {
          e.preventDefault();
          setTool(matched.id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    saveCurrentProject,
    undo,
    redo,
    deleteSelected,
    clearSelection,
    setTool,
    togglePlaying,
    toggleFullscreen,
    isFullscreen,
    moveSelectedBy,
    captureHistory,
    showToast,
  ]);

  if (!initialized || !project) {
    return (
      <div
        data-tb-theme={theme}
        className="tb-studio flex h-full min-h-[420px] w-full items-center justify-center bg-tb-canvas text-tb-text"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-xs font-semibold tracking-wider text-tb-muted uppercase">
            Loading Tactical Studio &amp; EPL Squads...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={studioRef}
      data-tb-theme={theme}
      className={`tb-studio flex flex-col overflow-hidden bg-tb-canvas text-tb-text transition-colors duration-150 ${
        isFullscreen
          ? 'fixed inset-0 z-[100] h-[100dvh] w-screen'
          : 'h-full min-h-0 w-full'
      }`}
    >
      {/* Top Professional Studio Bar */}
      <TopStudioBar
        svgRef={svgRef}
        sidebarOpen={sidebarOpen}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onOpenProjects={() => setProjectsOpen(true)}
      />

      {/* Main Studio Workspace */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left Tool Dock (Horizontal bar on Mobile/Tablet, Vertical rail on Desktop) */}
        <ToolDock
          onOpenStyleTab={() => {
            setSidebarTab('style');
            setSidebarOpen(true);
          }}
        />

        {/* Center Interactive Pitch Stage */}
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <TacticalCanvas svgRef={svgRef} />
        </main>

        {/* Right Inspector & Squad Panel (Docked on Desktop, Drawer on Tablet/Mobile) */}
        {sidebarOpen && (
          <>
            <div
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-30 bg-black/45 lg:hidden"
            />
            <div className="fixed top-12 right-0 bottom-0 z-40 lg:static lg:z-auto lg:h-full">
              <RightSidebar
                tab={sidebarTab}
                onTabChange={setSidebarTab}
                onCloseMobile={() => setSidebarOpen(false)}
              />
            </div>
          </>
        )}
      </div>

      {/* Bottom Scene & Animation Timeline */}
      <SceneTimeline />

      {/* Project Library & Data Manager Modal */}
      <ProjectModal
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
      />

      {/* Subtle Toast Feedback */}
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-28 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-emerald-500/40 bg-slate-950/95 px-4 py-1.5 text-xs font-semibold text-emerald-200 shadow-2xl backdrop-blur"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

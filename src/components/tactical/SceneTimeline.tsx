'use client';

import { useState } from 'react';
import {
  Copy,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { useTacticalStore } from '@/lib/tactical/store';

const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

export function SceneTimeline() {
  const project = useTacticalStore((s) => s.project);
  const isPlaying = useTacticalStore((s) => s.isPlaying);
  const playhead = useTacticalStore((s) => s.playhead);
  const playbackSpeed = useTacticalStore((s) => s.playbackSpeed);
  const loop = useTacticalStore((s) => s.loop);

  const selectScene = useTacticalStore((s) => s.selectScene);
  const addScene = useTacticalStore((s) => s.addScene);
  const duplicateScene = useTacticalStore((s) => s.duplicateScene);
  const renameScene = useTacticalStore((s) => s.renameScene);
  const updateSceneNotes = useTacticalStore((s) => s.updateSceneNotes);
  const deleteScene = useTacticalStore((s) => s.deleteScene);
  const togglePlaying = useTacticalStore((s) => s.togglePlaying);
  const resetPlayback = useTacticalStore((s) => s.resetPlayback);
  const setPlayhead = useTacticalStore((s) => s.setPlayhead);
  const setPlaybackSpeed = useTacticalStore((s) => s.setPlaybackSpeed);
  const setLoop = useTacticalStore((s) => s.setLoop);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  if (!project) return null;

  const scenes = project.scenes;
  const activeIdx = Math.max(
    0,
    scenes.findIndex((sc) => sc.id === project.activeSceneId),
  );
  const activeScene = scenes[activeIdx] ?? scenes[0];

  const stepPrev = () => {
    const prev = Math.max(0, activeIdx - 1);
    selectScene(scenes[prev].id);
  };

  const stepNext = () => {
    const next = Math.min(scenes.length - 1, activeIdx + 1);
    selectScene(scenes[next].id);
  };

  return (
    <section
      aria-label="Scene & Animation Timeline"
      className="flex shrink-0 flex-col border-t border-tb-border bg-tb-bar text-tb-text"
    >
      {/* Transport + Scrubber + Tactical Note Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tb-border-subtle px-3 py-1.5">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={resetPlayback}
            title="Reset to Scene 1"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-tb-border bg-tb-card text-tb-text-2 hover:bg-tb-hover hover:text-tb-text"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={stepPrev}
            disabled={activeIdx === 0}
            title="Previous Scene"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-tb-border bg-tb-card text-tb-text-2 hover:text-tb-text disabled:opacity-35"
          >
            <SkipBack size={13} />
          </button>
          <button
            type="button"
            onClick={togglePlaying}
            title={
              isPlaying ? 'Pause Animation (Space)' : 'Play Animation (Space)'
            }
            className={`flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={stepNext}
            disabled={activeIdx >= scenes.length - 1}
            title="Next Scene"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-tb-border bg-tb-card text-tb-text-2 hover:text-tb-text disabled:opacity-35"
          >
            <SkipForward size={13} />
          </button>

          <button
            type="button"
            onClick={() => setLoop(!loop)}
            title="Toggle Loop Playback"
            className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
              loop
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-500'
                : 'border-tb-border bg-tb-card text-tb-muted hover:text-tb-text'
            }`}
          >
            <Repeat size={13} />
          </button>

          {/* Speed Selector */}
          <div className="ml-1 flex items-center rounded-md border border-tb-border bg-tb-input p-0.5 text-[11px]">
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setPlaybackSpeed(sp)}
                className={`rounded px-1.5 py-0.5 font-semibold transition-colors ${
                  playbackSpeed === sp
                    ? 'bg-tb-hover text-tb-text shadow-xs'
                    : 'text-tb-muted hover:text-tb-text'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>

        {/* Continuous Scrubber when 2+ scenes */}
        {scenes.length > 1 && (
          <div className="flex min-w-[140px] flex-1 items-center gap-2 px-1 sm:max-w-xs">
            <span className="font-mono text-[11px] text-tb-muted">
              S{(playhead + 1).toFixed(1)}/{scenes.length}
            </span>
            <input
              type="range"
              min={0}
              max={scenes.length - 1}
              step={0.01}
              value={playhead}
              onChange={(e) => setPlayhead(parseFloat(e.target.value))}
              aria-label="Animation timeline scrubber"
              className="h-1.5 flex-1 cursor-pointer accent-emerald-500"
            />
          </div>
        )}

        {/* Active Scene Tactical Note Input */}
        <div className="flex min-w-[180px] flex-1 items-center gap-1.5 sm:max-w-md">
          <span className="shrink-0 text-[10px] font-semibold tracking-wider text-tb-muted uppercase">
            Note
          </span>
          <input
            type="text"
            value={activeScene.notes}
            onChange={(e) => updateSceneNotes(activeScene.id, e.target.value)}
            placeholder="Scene coaching note (included in Presentation Slide export)..."
            className="h-7 w-full rounded-md border border-tb-border bg-tb-input px-2.5 text-xs text-tb-text placeholder:text-tb-muted/70 focus:border-emerald-500/60 focus:outline-none"
          />
        </div>
      </div>

      {/* Scene Cards Strip */}
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2">
        {scenes.map((sc, idx) => {
          const isActive = sc.id === project.activeSceneId;
          const isRenaming = renamingId === sc.id;
          return (
            <div
              key={sc.id}
              onClick={() => selectScene(sc.id)}
              className={`group flex min-w-[155px] max-w-[205px] shrink-0 cursor-pointer flex-col justify-between rounded-lg border px-2.5 py-1.5 transition-all ${
                isActive
                  ? 'border-emerald-500/70 bg-emerald-500/10 shadow-[0_0_14px_rgba(16,185,129,0.12)]'
                  : 'border-tb-border bg-tb-card hover:bg-tb-hover'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-tb-input text-tb-muted'
                  }`}
                >
                  #{idx + 1}
                </span>

                <div className="flex items-center gap-0.5 opacity-75 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(sc.id);
                      setNameDraft(sc.name);
                    }}
                    title="Rename Scene"
                    className="rounded p-1 text-tb-muted hover:bg-tb-hover hover:text-tb-text"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateScene(sc.id);
                    }}
                    title="Duplicate Scene"
                    className="rounded p-1 text-tb-muted hover:bg-tb-hover hover:text-tb-text"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScene(sc.id);
                    }}
                    disabled={scenes.length <= 1}
                    title="Delete Scene"
                    className="rounded p-1 text-tb-muted hover:bg-rose-500/20 hover:text-rose-500 disabled:opacity-30"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              <div className="mt-1">
                {isRenaming ? (
                  <input
                    autoFocus
                    value={nameDraft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => {
                      renameScene(sc.id, nameDraft.trim() || `Scene ${idx + 1}`);
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameScene(
                          sc.id,
                          nameDraft.trim() || `Scene ${idx + 1}`,
                        );
                        setRenamingId(null);
                      }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="w-full rounded border border-emerald-500 bg-tb-input px-1.5 py-0.5 text-xs font-semibold text-tb-text outline-none"
                  />
                ) : (
                  <div className="truncate text-xs font-semibold text-tb-text">
                    {sc.name}
                  </div>
                )}
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-tb-muted">
                  <span>{sc.players.length} players</span>
                  <span>{sc.drawings.length} shapes</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Next Scene Button */}
        <button
          type="button"
          onClick={() => addScene('clone')}
          className="flex h-[58px] min-w-[116px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-tb-border bg-tb-input/60 px-3 text-xs font-semibold text-tb-text-2 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-500"
        >
          <Plus size={15} />
          <span>Add Scene</span>
        </button>
      </div>
    </section>
  );
}

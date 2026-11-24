'use client';

import {
  ArrowUpRight,
  Circle,
  Eraser,
  Highlighter,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Redo2,
  Spline,
  Square,
  Trash2,
  Type,
  Undo2,
  CircleDot,
  Orbit,
} from 'lucide-react';
import { useTacticalStore } from '@/lib/tactical/store';
import type { DrawingTool } from '@/lib/tactical/types';

interface ToolItem {
  id: DrawingTool;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: 'nav' | 'arrows' | 'shapes' | 'markers';
}

export const TACTICAL_TOOLS: ToolItem[] = [
  { id: 'select', label: 'Select / Move / Multi-Select', shortcut: 'V', icon: MousePointer2, group: 'nav' },
  { id: 'line', label: 'Straight Line', shortcut: 'L', icon: Minus, group: 'arrows' },
  { id: 'arrow', label: 'Straight Arrow', shortcut: 'A', icon: ArrowUpRight, group: 'arrows' },
  { id: 'dashed-arrow', label: 'Dashed Arrow (Run / Pass)', shortcut: 'D', icon: MoveUpRight, group: 'arrows' },
  { id: 'curved-arrow', label: 'Curved Arrow (Bendable)', shortcut: 'C', icon: Spline, group: 'arrows' },
  { id: 'freehand', label: 'Freehand Pen', shortcut: 'P', icon: Pencil, group: 'arrows' },
  { id: 'circle', label: 'Circle', shortcut: 'O', icon: Circle, group: 'shapes' },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square, group: 'shapes' },
  { id: 'highlight', label: 'Zone Highlight', shortcut: 'H', icon: Highlighter, group: 'shapes' },
  { id: 'ellipse-highlight', label: 'Ellipse Highlight', shortcut: 'E', icon: Orbit, group: 'shapes' },
  { id: 'text', label: 'Text Annotation', shortcut: 'T', icon: Type, group: 'markers' },
  { id: 'ball', label: 'Football Marker', shortcut: 'B', icon: CircleDot, group: 'markers' },
  { id: 'eraser', label: 'Eraser', shortcut: 'X', icon: Eraser, group: 'markers' },
];

export const QUICK_COLORS = [
  '#facc15', // Tactical Yellow
  '#ffffff', // White
  '#38bdf8', // Sky Cyan
  '#22c55e', // Emerald
  '#ef4444', // Red
  '#fb923c', // Orange
  '#a78bfa', // Violet
];

export function ToolDock({
  onOpenStyleTab,
}: {
  onOpenStyleTab: () => void;
}) {
  const tool = useTacticalStore((s) => s.tool);
  const drawStyle = useTacticalStore((s) => s.drawStyle);
  const selectedIds = useTacticalStore((s) => s.selectedIds);
  const pastLen = useTacticalStore((s) => s.past.length);
  const futureLen = useTacticalStore((s) => s.future.length);

  const setTool = useTacticalStore((s) => s.setTool);
  const setDrawStyle = useTacticalStore((s) => s.setDrawStyle);
  const updateSelectedDrawingsStyle = useTacticalStore(
    (s) => s.updateSelectedDrawingsStyle,
  );
  const undo = useTacticalStore((s) => s.undo);
  const redo = useTacticalStore((s) => s.redo);
  const clearDrawings = useTacticalStore((s) => s.clearDrawings);
  const deleteSelected = useTacticalStore((s) => s.deleteSelected);

  const applyColor = (color: string) => {
    setDrawStyle({ color });
    if (selectedIds.length > 0) {
      updateSelectedDrawingsStyle({ color });
    }
  };

  return (
    <aside
      aria-label="Drawing Tools"
      className="flex shrink-0 flex-row items-center gap-1 overflow-x-auto border-b border-tb-border bg-tb-panel px-2 py-1.5 lg:w-[52px] lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-1.5 lg:py-1.5"
    >
      {TACTICAL_TOOLS.map((item, idx) => {
        const Icon = item.icon;
        const active = tool === item.id;
        const prevGroup = idx > 0 ? TACTICAL_TOOLS[idx - 1].group : item.group;
        return (
          <div key={item.id} className="flex items-center lg:flex-col">
            {idx > 0 && prevGroup !== item.group && (
              <div className="mx-1 h-5 w-px bg-tb-border lg:mx-0 lg:my-0.5 lg:h-px lg:w-7" />
            )}
            <button
              type="button"
              onClick={() => setTool(item.id)}
              title={`${item.label} (${item.shortcut})`}
              aria-label={item.label}
              aria-pressed={active}
              className={`group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
                active
                  ? 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'text-tb-muted hover:bg-tb-hover hover:text-tb-text'
              }`}
            >
              <Icon size={16} />
              <span className="pointer-events-none absolute right-0.5 bottom-0 hidden text-[7.5px] font-bold opacity-55 lg:inline">
                {item.shortcut}
              </span>
            </button>
          </div>
        );
      })}

      <div className="mx-1 h-5 w-px bg-tb-border lg:mx-0 lg:my-1 lg:h-px lg:w-7" />

      {/* Quick Color Swatches (compact 2-col grid on desktop rail) */}
      <div className="flex items-center gap-1 lg:grid lg:grid-cols-2 lg:gap-1">
        {QUICK_COLORS.slice(0, 5).map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => applyColor(col)}
            title={`Color ${col}`}
            aria-label={`Select color ${col}`}
            className={`h-3.5 w-3.5 shrink-0 rounded-full border transition-transform hover:scale-110 ${
              drawStyle.color.toLowerCase() === col.toLowerCase()
                ? 'scale-110 border-tb-text ring-2 ring-sky-400/70'
                : 'border-tb-border'
            }`}
            style={{ backgroundColor: col }}
          />
        ))}
        <button
          type="button"
          onClick={onOpenStyleTab}
          title="Full Style & Opacity Controls"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-tb-border bg-tb-input text-[8px] font-bold text-tb-text-2 hover:border-tb-muted"
        >
          {Math.round(drawStyle.strokeWidth)}
        </button>
      </div>

      <div className="mx-1 h-5 w-px bg-tb-border lg:mx-0 lg:my-1 lg:h-px lg:w-7" />

      {/* History & Clear Actions */}
      <div className="flex items-center gap-1 lg:flex-col lg:gap-0.5">
        <button
          type="button"
          onClick={undo}
          disabled={pastLen === 0}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-tb-text-2 transition-colors hover:bg-tb-hover disabled:opacity-30"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={futureLen === 0}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-tb-text-2 transition-colors hover:bg-tb-hover disabled:opacity-30"
        >
          <Redo2 size={15} />
        </button>
        <button
          type="button"
          onClick={() =>
            selectedIds.length > 0 ? deleteSelected() : clearDrawings()
          }
          title={
            selectedIds.length > 0
              ? 'Delete Selected (Del)'
              : 'Clear Drawings in Scene'
          }
          aria-label="Clear or Delete"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-500/15"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </aside>
  );
}

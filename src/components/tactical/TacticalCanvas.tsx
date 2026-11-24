'use client';

import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  clampLogical,
  clientToLogical,
  defaultCurveControlPoint,
  getDrawingBounds,
  getPitchViewBox,
  hitTestDrawing,
  interpolateScenes,
  logicalToDisplay,
  rectsIntersect,
  simplifyPoints,
} from '@/lib/tactical/geometry';
import { useTacticalStore } from '@/lib/tactical/store';
import type {
  BallMarker,
  BoardPlayer,
  CurvedArrowDrawing,
  DrawingObject,
  LineDrawing,
  PitchOrientation,
  Point,
  RosterPlayer,
  TeamSide,
} from '@/lib/tactical/types';
import { PitchSvg } from './PitchSvg';

type DragMode =
  | { kind: 'move-selected'; lastLogical: Point }
  | {
      kind: 'handle';
      drawingId: string;
      handle: 'start' | 'end' | 'ctrl';
    }
  | { kind: 'marquee'; start: Point; current: Point }
  | { kind: 'draw'; draft: DrawingObject; start: Point }
  | { kind: 'erase'; erasedIds: Set<string> }
  | null;

interface InlineTextEdit {
  id: string | null; // null = creating new text
  logical: Point;
  screen: { left: number; top: number };
  value: string;
}

function makeDrawingId(): string {
  return `draw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function arrowMarkerId(color: string): string {
  return `ah-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export function TacticalCanvas({
  svgRef,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const project = useTacticalStore((s) => s.project);
  const tool = useTacticalStore((s) => s.tool);
  const drawStyle = useTacticalStore((s) => s.drawStyle);
  const selectedIds = useTacticalStore((s) => s.selectedIds);
  const isPlaying = useTacticalStore((s) => s.isPlaying);
  const playhead = useTacticalStore((s) => s.playhead);

  const selectOnly = useTacticalStore((s) => s.selectOnly);
  const toggleSelect = useTacticalStore((s) => s.toggleSelect);
  const setSelectedIds = useTacticalStore((s) => s.setSelectedIds);
  const clearSelection = useTacticalStore((s) => s.clearSelection);
  const captureHistory = useTacticalStore((s) => s.captureHistory);
  const moveSelectedBy = useTacticalStore((s) => s.moveSelectedBy);
  const addDrawing = useTacticalStore((s) => s.addDrawing);
  const updateDrawing = useTacticalStore((s) => s.updateDrawing);
  const removeDrawing = useTacticalStore((s) => s.removeDrawing);
  const addBall = useTacticalStore((s) => s.addBall);
  const removeBall = useTacticalStore((s) => s.removeBall);
  const addPlayerToPitch = useTacticalStore((s) => s.addPlayerToPitch);

  const [drag, setDrag] = useState<DragMode>(null);
  const [textEdit, setTextEdit] = useState<InlineTextEdit | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSceneIdx = useMemo(() => {
    if (!project) return 0;
    return Math.max(
      0,
      project.scenes.findIndex((s) => s.id === project.activeSceneId),
    );
  }, [project]);

  const activeScene = project?.scenes[activeSceneIdx] ?? null;

  // Interpolated frame when animating or scrubbing between scenes
  const frame = useMemo(() => {
    if (!project || !activeScene) {
      return { players: [], balls: [], drawings: [], trails: [] };
    }
    const maxIdx = project.scenes.length - 1;
    const clamped = Math.max(0, Math.min(maxIdx, playhead));
    const idxA = Math.floor(clamped);
    const idxB = Math.min(maxIdx, idxA + 1);
    const frac = clamped - idxA;

    if (idxA !== idxB && frac > 0.001) {
      return interpolateScenes(project.scenes[idxA], project.scenes[idxB], frac);
    }

    // When stationary on Scene >= 1, show subtle ghost trails from previous scene if showTrails enabled
    const trails: {
      id: string;
      team: 'home' | 'away';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[] = [];
    if (project.pitch.showTrails && idxA > 0) {
      const prev = project.scenes[idxA - 1];
      const prevMap = new Map(prev.players.map((p) => [p.id, p]));
      for (const cur of project.scenes[idxA].players) {
        const pp = prevMap.get(cur.id);
        if (pp && Math.hypot(cur.x - pp.x, cur.y - pp.y) > 12) {
          trails.push({
            id: cur.id,
            team: cur.team,
            x1: pp.x,
            y1: pp.y,
            x2: cur.x,
            y2: cur.y,
          });
        }
      }
    }

    return {
      players: project.scenes[idxA].players,
      balls: project.scenes[idxA].balls,
      drawings: project.scenes[idxA].drawings,
      trails,
    };
  }, [project, activeScene, playhead]);

  // Unique arrow colors for crisp SVG <marker> definitions
  const arrowColors = useMemo(() => {
    const set = new Set<string>([drawStyle.color]);
    for (const d of frame.drawings) {
      if (
        d.type === 'arrow' ||
        d.type === 'dashed-arrow' ||
        d.type === 'curved-arrow'
      ) {
        set.add(d.color);
      }
    }
    if (drag?.kind === 'draw') set.add(drag.draft.color);
    return Array.from(set);
  }, [frame.drawings, drawStyle.color, drag]);

  if (!project || !activeScene) return null;

  const { pitch, home, away } = project;
  const orientation = pitch.orientation;
  const vb = getPitchViewBox(pitch.view, orientation);
  const selectedSet = new Set(selectedIds);

  const visiblePlayers = frame.players.filter((p) =>
    p.team === 'home' ? home.visible : away.visible,
  );

  const openTextEditor = (id: string | null, logical: Point, value: string) => {
    const svg = svgRef.current;
    const container = containerRef.current;
    let screen = { left: 240, top: 180 };
    if (svg && container) {
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const disp = logicalToDisplay(logical, orientation);
        const pt = svg.createSVGPoint();
        pt.x = disp.x;
        pt.y = disp.y;
        const screenPt = pt.matrixTransform(ctm);
        const rect = container.getBoundingClientRect();
        screen = {
          left: screenPt.x - rect.left,
          top: screenPt.y - rect.top,
        };
      }
    }
    setTextEdit({ id, logical, screen, value });
  };

  const commitTextEdit = () => {
    if (!textEdit) return;
    const trimmed = textEdit.value.trim();
    if (textEdit.id) {
      if (trimmed) {
        captureHistory();
        updateDrawing(textEdit.id, { text: trimmed });
      } else {
        removeDrawing(textEdit.id);
      }
    } else if (trimmed) {
      addDrawing({
        id: makeDrawingId(),
        type: 'text',
        x: textEdit.logical.x,
        y: textEdit.logical.y,
        text: trimmed,
        fontSize: drawStyle.fontSize,
        color: drawStyle.color,
        strokeWidth: 0,
        opacity: drawStyle.opacity,
        bgOpacity: 0.72,
      });
    }
    setTextEdit(null);
  };

  const eraseAtPoint = (pt: Point, erasedSet: Set<string>) => {
    // Check drawings top-down
    for (let i = activeScene.drawings.length - 1; i >= 0; i--) {
      const d = activeScene.drawings[i];
      if (!erasedSet.has(d.id) && hitTestDrawing(d, pt, 16)) {
        erasedSet.add(d.id);
        removeDrawing(d.id);
        return;
      }
    }
    // Check balls
    for (const b of activeScene.balls) {
      if (!erasedSet.has(b.id) && Math.hypot(b.x - pt.x, b.y - pt.y) <= 22) {
        erasedSet.add(b.id);
        removeBall(b.id);
        return;
      }
    }
  };

  const handleBackgroundPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (isPlaying) return;
    if (textEdit) commitTextEdit();
    if (e.button !== 0) return;

    const svg = svgRef.current;
    if (!svg) return;
    const pt = clampLogical(
      clientToLogical(svg, e.clientX, e.clientY, orientation),
    );

    if (tool === 'select') {
      if (!e.shiftKey) clearSelection();
      svg.setPointerCapture(e.pointerId);
      setDrag({ kind: 'marquee', start: pt, current: pt });
      return;
    }

    if (tool === 'ball') {
      addBall(pt.x, pt.y);
      return;
    }

    if (tool === 'text') {
      openTextEditor(null, pt, '');
      return;
    }

    if (tool === 'eraser') {
      const erasedIds = new Set<string>();
      eraseAtPoint(pt, erasedIds);
      svg.setPointerCapture(e.pointerId);
      setDrag({ kind: 'erase', erasedIds });
      return;
    }

    // Start creating a new drawing shape
    const id = makeDrawingId();
    const base = {
      id,
      color: drawStyle.color,
      strokeWidth: drawStyle.strokeWidth,
      opacity: drawStyle.opacity,
    };

    let draft: DrawingObject;
    switch (tool) {
      case 'line':
      case 'arrow':
      case 'dashed-arrow':
        draft = { ...base, type: tool, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
        break;
      case 'curved-arrow':
        draft = {
          ...base,
          type: 'curved-arrow',
          x1: pt.x,
          y1: pt.y,
          cx: pt.x,
          cy: pt.y,
          x2: pt.x,
          y2: pt.y,
        };
        break;
      case 'freehand':
        draft = { ...base, type: 'freehand', points: [pt] };
        break;
      case 'circle':
        draft = {
          ...base,
          type: 'circle',
          cx: pt.x,
          cy: pt.y,
          r: 1,
          fillOpacity: drawStyle.fillOpacity,
        };
        break;
      case 'rectangle':
        draft = {
          ...base,
          type: 'rectangle',
          x: pt.x,
          y: pt.y,
          w: 0,
          h: 0,
          fillOpacity: drawStyle.fillOpacity,
        };
        break;
      case 'highlight':
        draft = {
          ...base,
          type: 'highlight',
          x: pt.x,
          y: pt.y,
          w: 0,
          h: 0,
          strokeWidth: Math.max(1.5, drawStyle.strokeWidth * 0.6),
          fillOpacity: Math.max(0.24, drawStyle.fillOpacity),
        };
        break;
      case 'ellipse-highlight':
        draft = {
          ...base,
          type: 'ellipse-highlight',
          cx: pt.x,
          cy: pt.y,
          rx: 1,
          ry: 1,
          strokeWidth: Math.max(1.5, drawStyle.strokeWidth * 0.6),
          fillOpacity: Math.max(0.24, drawStyle.fillOpacity),
        };
        break;
    }

    svg.setPointerCapture(e.pointerId);
    setDrag({ kind: 'draw', draft, start: pt });
  };

  const handleObjectPointerDown = (
    e: PointerEvent,
    id: string,
    isErasable = false,
  ) => {
    if (isPlaying) return;
    if (tool === 'eraser' && isErasable) {
      e.stopPropagation();
      if (id.startsWith('ball-')) removeBall(id);
      else removeDrawing(id);
      return;
    }
    if (tool !== 'select') return;
    e.stopPropagation();
    if (textEdit) commitTextEdit();

    const svg = svgRef.current;
    if (!svg) return;
    const pt = clampLogical(
      clientToLogical(svg, e.clientX, e.clientY, orientation),
    );

    if (e.shiftKey) {
      toggleSelect(id);
    } else if (!selectedSet.has(id)) {
      selectOnly(id);
    }

    captureHistory();
    svg.setPointerCapture(e.pointerId);
    setDrag({ kind: 'move-selected', lastLogical: pt });
  };

  const handleControlPointDown = (
    e: PointerEvent,
    drawingId: string,
    handle: 'start' | 'end' | 'ctrl',
  ) => {
    if (isPlaying || tool !== 'select') return;
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    captureHistory();
    svg.setPointerCapture(e.pointerId);
    setDrag({ kind: 'handle', drawingId, handle });
  };

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = clampLogical(
      clientToLogical(svg, e.clientX, e.clientY, orientation),
    );

    if (drag.kind === 'move-selected') {
      const dx = pt.x - drag.lastLogical.x;
      const dy = pt.y - drag.lastLogical.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        moveSelectedBy(dx, dy);
        setDrag({ kind: 'move-selected', lastLogical: pt });
      }
      return;
    }

    if (drag.kind === 'handle') {
      const target = activeScene.drawings.find((d) => d.id === drag.drawingId);
      if (!target) return;
      if (
        target.type === 'line' ||
        target.type === 'arrow' ||
        target.type === 'dashed-arrow'
      ) {
        if (drag.handle === 'start') {
          updateDrawing(target.id, { x1: pt.x, y1: pt.y });
        } else if (drag.handle === 'end') {
          updateDrawing(target.id, { x2: pt.x, y2: pt.y });
        }
      } else if (target.type === 'curved-arrow') {
        if (drag.handle === 'start') {
          updateDrawing(target.id, { x1: pt.x, y1: pt.y });
        } else if (drag.handle === 'end') {
          updateDrawing(target.id, { x2: pt.x, y2: pt.y });
        } else if (drag.handle === 'ctrl') {
          updateDrawing(target.id, { cx: pt.x, cy: pt.y });
        }
      }
      return;
    }

    if (drag.kind === 'marquee') {
      setDrag({ ...drag, current: pt });
      return;
    }

    if (drag.kind === 'erase') {
      eraseAtPoint(pt, drag.erasedIds);
      return;
    }

    if (drag.kind === 'draw') {
      const { draft, start } = drag;
      let next: DrawingObject = draft;
      switch (draft.type) {
        case 'line':
        case 'arrow':
        case 'dashed-arrow':
          next = { ...draft, x2: pt.x, y2: pt.y };
          break;
        case 'curved-arrow': {
          const ctrl = defaultCurveControlPoint(start.x, start.y, pt.x, pt.y);
          next = { ...draft, x2: pt.x, y2: pt.y, cx: ctrl.x, cy: ctrl.y };
          break;
        }
        case 'freehand': {
          const last = draft.points[draft.points.length - 1];
          if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 3) {
            next = { ...draft, points: [...draft.points, pt] };
          }
          break;
        }
        case 'circle':
          next = {
            ...draft,
            r: Math.hypot(pt.x - start.x, pt.y - start.y),
          };
          break;
        case 'rectangle':
        case 'highlight':
          next = {
            ...draft,
            x: Math.min(start.x, pt.x),
            y: Math.min(start.y, pt.y),
            w: Math.abs(pt.x - start.x),
            h: Math.abs(pt.y - start.y),
          };
          break;
        case 'ellipse-highlight':
          next = {
            ...draft,
            cx: (start.x + pt.x) / 2,
            cy: (start.y + pt.y) / 2,
            rx: Math.abs(pt.x - start.x) / 2,
            ry: Math.abs(pt.y - start.y) / 2,
          };
          break;
      }
      setDrag({ ...drag, draft: next });
    }
  };

  const handlePointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const svg = svgRef.current;
    if (svg && svg.hasPointerCapture(e.pointerId)) {
      svg.releasePointerCapture(e.pointerId);
    }

    if (drag.kind === 'marquee') {
      const box = {
        minX: Math.min(drag.start.x, drag.current.x),
        minY: Math.min(drag.start.y, drag.current.y),
        maxX: Math.max(drag.start.x, drag.current.x),
        maxY: Math.max(drag.start.y, drag.current.y),
      };
      if (box.maxX - box.minX > 6 || box.maxY - box.minY > 6) {
        const hits: string[] = [];
        for (const p of visiblePlayers) {
          if (
            p.x >= box.minX &&
            p.x <= box.maxX &&
            p.y >= box.minY &&
            p.y <= box.maxY
          ) {
            hits.push(p.id);
          }
        }
        for (const b of frame.balls) {
          if (
            b.x >= box.minX &&
            b.x <= box.maxX &&
            b.y >= box.minY &&
            b.y <= box.maxY
          ) {
            hits.push(b.id);
          }
        }
        for (const d of frame.drawings) {
          if (rectsIntersect(getDrawingBounds(d), box)) {
            hits.push(d.id);
          }
        }
        setSelectedIds(hits);
      }
    } else if (drag.kind === 'draw') {
      const d = drag.draft;
      let valid = true;
      if (
        d.type === 'line' ||
        d.type === 'arrow' ||
        d.type === 'dashed-arrow' ||
        d.type === 'curved-arrow'
      ) {
        valid = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 10;
      } else if (d.type === 'freehand') {
        valid = d.points.length >= 2;
      } else if (d.type === 'circle') {
        valid = d.r > 6;
      } else if (d.type === 'rectangle' || d.type === 'highlight') {
        valid = d.w > 8 && d.h > 8;
      } else if (d.type === 'ellipse-highlight') {
        valid = d.rx > 6 && d.ry > 6;
      }

      if (valid) {
        const finalDrawing =
          d.type === 'freehand'
            ? { ...d, points: simplifyPoints(d.points, 2.5) }
            : d;
        addDrawing(finalDrawing);
      }
    }

    setDrag(null);
  };

  // Drag & Drop from Squad Panel onto Pitch
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('application/x-tactical-player')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!dropActive) setDropActive(true);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);
    const raw = e.dataTransfer.getData('application/x-tactical-player');
    if (!raw || !svgRef.current) return;
    try {
      const payload = JSON.parse(raw) as {
        side: TeamSide;
        player: RosterPlayer;
      };
      const pt = clampLogical(
        clientToLogical(svgRef.current, e.clientX, e.clientY, orientation),
      );
      // Check if dropped onto an existing player of the same team to swap cleanly
      const targetSwap = visiblePlayers.find(
        (p) =>
          p.team === payload.side && Math.hypot(p.x - pt.x, p.y - pt.y) <= 34,
      );
      addPlayerToPitch(payload.side, payload.player, pt, targetSwap?.id);
    } catch {
      // ignore invalid drag data
    }
  };

  const cursorClass =
    tool === 'select'
      ? 'cursor-default'
      : tool === 'eraser'
        ? 'cursor-cell'
        : tool === 'text'
          ? 'cursor-text'
          : 'cursor-crosshair';

  const allDrawingsToRender =
    drag?.kind === 'draw' ? [...frame.drawings, drag.draft] : frame.drawings;

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropActive(false)}
      onDrop={handleDrop}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-tb-canvas p-2 sm:p-4 select-none ${
        dropActive ? 'ring-2 ring-inset ring-emerald-400/70' : ''
      }`}
    >
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`h-full w-full max-h-full max-w-full rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.65)] touch-none ${cursorClass}`}
      >
        <defs>
          {arrowColors.map((col) => (
            <marker
              key={col}
              id={arrowMarkerId(col)}
              markerWidth="5.5"
              markerHeight="5.5"
              refX="4.3"
              refY="2.75"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0.4 0.5 L 5.1 2.75 L 0.4 5 Z" fill={col} />
            </marker>
          ))}
          <filter id="token-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="3"
              floodColor="#000000"
              floodOpacity="0.48"
            />
          </filter>
        </defs>

        {/* 1. Pitch Layer */}
        <PitchSvg
          theme={pitch.theme}
          orientation={orientation}
          zoneOverlay={pitch.zoneOverlay}
        />

        {/* 2. Movement Trails Layer */}
        {pitch.showTrails && frame.trails.length > 0 && (
          <g pointerEvents="none">
            {frame.trails.map((tr) => {
              const p1 = logicalToDisplay({ x: tr.x1, y: tr.y1 }, orientation);
              const p2 = logicalToDisplay({ x: tr.x2, y: tr.y2 }, orientation);
              const col =
                tr.team === 'home' ? home.primaryColor : away.primaryColor;
              return (
                <g key={`trail-${tr.id}`}>
                  <circle
                    cx={p1.x}
                    cy={p1.y}
                    r={5}
                    fill={col}
                    fillOpacity={0.35}
                  />
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={col}
                    strokeWidth={2.5}
                    strokeOpacity={0.55}
                    strokeDasharray="5 5"
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* 3. Tactical Drawings Layer */}
        <g>
          {allDrawingsToRender.map((d) => {
            const renderOpacity =
              '_renderOpacity' in d && typeof d._renderOpacity === 'number'
                ? d._renderOpacity
                : d.opacity;
            const isSelected = selectedSet.has(d.id);
            return (
              <DrawingShape
                key={d.id}
                drawing={d}
                orientation={orientation}
                opacity={renderOpacity}
                isSelected={isSelected}
                onPointerDown={(e) => handleObjectPointerDown(e, d.id, true)}
                onDoubleClick={(e) => {
                  if (d.type === 'text' && !isPlaying) {
                    e.stopPropagation();
                    openTextEditor(d.id, { x: d.x, y: d.y }, d.text);
                  }
                }}
                onHandleDown={(e, h) => handleControlPointDown(e, d.id, h)}
              />
            );
          })}
        </g>

        {/* 4. Players Layer */}
        <g>
          {visiblePlayers.map((player) => (
            <PlayerToken
              key={player.id}
              player={player}
              orientation={orientation}
              globalSize={pitch.playerSize}
              teamColor={
                player.customColor ??
                (player.isGk
                  ? player.team === 'home'
                    ? home.gkColor
                    : away.gkColor
                  : player.team === 'home'
                    ? home.primaryColor
                    : away.primaryColor)
              }
              textColor={
                player.isGk
                  ? '#0f172a'
                  : player.team === 'home'
                    ? home.secondaryColor
                    : away.secondaryColor
              }
              showName={pitch.showNames}
              showNumber={pitch.showNumbers}
              showRole={pitch.showRoles}
              isSelected={selectedSet.has(player.id)}
              onPointerDown={(e) => handleObjectPointerDown(e, player.id, false)}
            />
          ))}
        </g>

        {/* 5. Football Markers Layer */}
        <g>
          {frame.balls.map((ball) => (
            <BallToken
              key={ball.id}
              ball={ball}
              orientation={orientation}
              isSelected={selectedSet.has(ball.id)}
              onPointerDown={(e) => handleObjectPointerDown(e, ball.id, true)}
            />
          ))}
        </g>

        {/* 6. Marquee Multi-Selection Overlay */}
        {drag?.kind === 'marquee' && (() => {
          const p1 = logicalToDisplay(drag.start, orientation);
          const p2 = logicalToDisplay(drag.current, orientation);
          const rx = Math.min(p1.x, p2.x);
          const ry = Math.min(p1.y, p2.y);
          const rw = Math.abs(p2.x - p1.x);
          const rh = Math.abs(p2.y - p1.y);
          return (
            <rect
              data-editor-only="true"
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              fill="rgba(56,189,248,0.12)"
              stroke="#38bdf8"
              strokeWidth={1.6}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          );
        })()}
      </svg>

      {/* Inline Text Annotation Input */}
      {textEdit && (
        <div
          style={{
            left: `${textEdit.screen.left}px`,
            top: `${textEdit.screen.top}px`,
          }}
          className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
        >
          <input
            autoFocus
            type="text"
            value={textEdit.value}
            onChange={(e) =>
              setTextEdit({ ...textEdit, value: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTextEdit();
              if (e.key === 'Escape') setTextEdit(null);
            }}
            onBlur={commitTextEdit}
            placeholder="Type tactical note..."
            className="w-48 rounded-md border border-sky-400 bg-slate-950/95 px-2.5 py-1 text-center text-sm font-semibold text-white shadow-xl outline-none"
          />
        </div>
      )}

      {/* Drop Hint Banner */}
      {dropActive && (
        <div className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 rounded-full border border-emerald-400/50 bg-emerald-950/90 px-4 py-1.5 text-xs font-medium text-emerald-200 shadow-lg backdrop-blur">
          Drop player on pitch to place — or drop directly on a player to swap
        </div>
      )}
    </div>
  );
}

function PlayerToken({
  player,
  orientation,
  globalSize,
  teamColor,
  textColor,
  showName,
  showNumber,
  showRole,
  isSelected,
  onPointerDown,
}: {
  player: BoardPlayer;
  orientation: PitchOrientation;
  globalSize: number;
  teamColor: string;
  textColor: string;
  showName: boolean;
  showNumber: boolean;
  showRole: boolean;
  isSelected: boolean;
  onPointerDown: (e: PointerEvent) => void;
}) {
  const disp = logicalToDisplay({ x: player.x, y: player.y }, orientation);
  const r = 19 * globalSize * player.size;
  const label = player.shortName || player.name;
  const pillW = Math.max(46, Math.min(118, label.length * 6.8 + 14));

  return (
    <g
      transform={`translate(${disp.x}, ${disp.y})`}
      onPointerDown={onPointerDown}
      className="cursor-grab active:cursor-grabbing"
    >
      {/* Selection ring (stripped on export) */}
      {isSelected && (
        <circle
          data-editor-only="true"
          cx={0}
          cy={0}
          r={r + 6}
          fill="rgba(56,189,248,0.16)"
          stroke="#38bdf8"
          strokeWidth={2.2}
          strokeDasharray="4 3"
        />
      )}

      {/* Main Player Disc */}
      <circle
        cx={0}
        cy={0}
        r={r}
        fill={teamColor}
        stroke="#ffffff"
        strokeWidth={2.2}
        filter="url(#token-shadow)"
      />
      {/* Subtle inner rim */}
      <circle
        cx={0}
        cy={0}
        r={Math.max(2, r - 3.2)}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1}
      />

      {/* Shirt Number or Role Fallback */}
      {showNumber && (
        <text
          x={0}
          y={1}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          fontSize={Math.round(r * 0.72)}
          fontWeight={800}
          style={{ pointerEvents: 'none' }}
        >
          {player.number || player.slotRole}
        </text>
      )}

      {/* Optional Role Micro-Badge */}
      {showRole && (
        <g transform={`translate(${r * 0.78}, ${-r * 0.72})`}>
          <rect
            x={-15}
            y={-8}
            width={30}
            height={15}
            rx={4}
            fill="#0b1220"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={0.9}
          />
          <text
            x={0}
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#e2e8f0"
            fontSize={8.5}
            fontWeight={700}
          >
            {player.slotRole}
          </text>
        </g>
      )}

      {/* Player Name Pill */}
      {showName && (
        <g transform={`translate(0, ${r + 12})`}>
          <rect
            x={-pillW / 2}
            y={-9}
            width={pillW}
            height={18}
            rx={5}
            fill="rgba(9,13,20,0.82)"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={0.8}
          />
          <text
            x={0}
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#f8fafc"
            fontSize={10.5}
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {label.length > 15 ? `${label.slice(0, 14)}…` : label}
          </text>
        </g>
      )}
    </g>
  );
}

function BallToken({
  ball,
  orientation,
  isSelected,
  onPointerDown,
}: {
  ball: BallMarker;
  orientation: PitchOrientation;
  isSelected: boolean;
  onPointerDown: (e: PointerEvent) => void;
}) {
  const disp = logicalToDisplay({ x: ball.x, y: ball.y }, orientation);
  const r = 11 * ball.size;
  return (
    <g
      transform={`translate(${disp.x}, ${disp.y})`}
      onPointerDown={onPointerDown}
      className="cursor-grab active:cursor-grabbing"
    >
      {isSelected && (
        <circle
          data-editor-only="true"
          cx={0}
          cy={0}
          r={r + 5}
          fill="rgba(56,189,248,0.18)"
          stroke="#38bdf8"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
      )}
      <circle
        cx={0}
        cy={0}
        r={r}
        fill="#f8fafc"
        stroke="#0f172a"
        strokeWidth={1.6}
        filter="url(#token-shadow)"
      />
      {/* Classic pentagon football pattern */}
      <polygon
        points={`0,${-r * 0.42} ${r * 0.4},${-r * 0.12} ${r * 0.25},${r * 0.36} ${-r * 0.25},${r * 0.36} ${-r * 0.4},${-r * 0.12}`}
        fill="#0f172a"
      />
      <line x1={0} y1={-r * 0.42} x2={0} y2={-r} stroke="#0f172a" strokeWidth={1.1} />
      <line x1={r * 0.4} y1={-r * 0.12} x2={r * 0.92} y2={-r * 0.32} stroke="#0f172a" strokeWidth={1.1} />
      <line x1={-r * 0.4} y1={-r * 0.12} x2={-r * 0.92} y2={-r * 0.32} stroke="#0f172a" strokeWidth={1.1} />
      <line x1={r * 0.25} y1={r * 0.36} x2={r * 0.65} y2={r * 0.78} stroke="#0f172a" strokeWidth={1.1} />
      <line x1={-r * 0.25} y1={r * 0.36} x2={-r * 0.65} y2={r * 0.78} stroke="#0f172a" strokeWidth={1.1} />
    </g>
  );
}

function DrawingShape({
  drawing,
  orientation,
  opacity,
  isSelected,
  onPointerDown,
  onDoubleClick,
  onHandleDown,
}: {
  drawing: DrawingObject;
  orientation: PitchOrientation;
  opacity: number;
  isSelected: boolean;
  onPointerDown: (e: PointerEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onHandleDown: (e: PointerEvent, handle: 'start' | 'end' | 'ctrl') => void;
}) {
  const pt = (x: number, y: number) => logicalToDisplay({ x, y }, orientation);

  switch (drawing.type) {
    case 'line':
    case 'arrow':
    case 'dashed-arrow': {
      const d = drawing as LineDrawing;
      const p1 = pt(d.x1, d.y1);
      const p2 = pt(d.x2, d.y2);
      const hasArrow = d.type === 'arrow' || d.type === 'dashed-arrow';
      return (
        <g opacity={opacity} onPointerDown={onPointerDown} className="cursor-move">
          {/* Wide invisible hit target */}
          <line
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="transparent"
            strokeWidth={18}
          />
          {isSelected && (
            <line
              data-editor-only="true"
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#38bdf8"
              strokeWidth={d.strokeWidth + 6}
              strokeOpacity={0.35}
              strokeLinecap="round"
            />
          )}
          <line
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={d.color}
            strokeWidth={d.strokeWidth}
            strokeDasharray={d.type === 'dashed-arrow' ? '11 7' : undefined}
            strokeLinecap="round"
            markerEnd={hasArrow ? `url(#${arrowMarkerId(d.color)})` : undefined}
          />
          {isSelected && (
            <g data-editor-only="true">
              <HandleDot
                x={p1.x}
                y={p1.y}
                onPointerDown={(e) => onHandleDown(e, 'start')}
              />
              <HandleDot
                x={p2.x}
                y={p2.y}
                onPointerDown={(e) => onHandleDown(e, 'end')}
              />
            </g>
          )}
        </g>
      );
    }

    case 'curved-arrow': {
      const d = drawing as CurvedArrowDrawing;
      const p1 = pt(d.x1, d.y1);
      const pc = pt(d.cx, d.cy);
      const p2 = pt(d.x2, d.y2);
      const pathD = `M ${p1.x} ${p1.y} Q ${pc.x} ${pc.y} ${p2.x} ${p2.y}`;
      return (
        <g opacity={opacity} onPointerDown={onPointerDown} className="cursor-move">
          <path d={pathD} fill="none" stroke="transparent" strokeWidth={20} />
          {isSelected && (
            <path
              data-editor-only="true"
              d={pathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={d.strokeWidth + 6}
              strokeOpacity={0.35}
              strokeLinecap="round"
            />
          )}
          <path
            d={pathD}
            fill="none"
            stroke={d.color}
            strokeWidth={d.strokeWidth}
            strokeLinecap="round"
            markerEnd={`url(#${arrowMarkerId(d.color)})`}
          />
          {isSelected && (
            <g data-editor-only="true">
              <line
                x1={p1.x}
                y1={p1.y}
                x2={pc.x}
                y2={pc.y}
                stroke="#38bdf8"
                strokeWidth={1.1}
                strokeDasharray="4 4"
                pointerEvents="none"
              />
              <line
                x1={p2.x}
                y1={p2.y}
                x2={pc.x}
                y2={pc.y}
                stroke="#38bdf8"
                strokeWidth={1.1}
                strokeDasharray="4 4"
                pointerEvents="none"
              />
              <HandleDot
                x={p1.x}
                y={p1.y}
                onPointerDown={(e) => onHandleDown(e, 'start')}
              />
              <HandleDot
                x={pc.x}
                y={pc.y}
                accent="#f59e0b"
                onPointerDown={(e) => onHandleDown(e, 'ctrl')}
              />
              <HandleDot
                x={p2.x}
                y={p2.y}
                onPointerDown={(e) => onHandleDown(e, 'end')}
              />
            </g>
          )}
        </g>
      );
    }

    case 'freehand': {
      if (drawing.points.length < 2) return null;
      const pts = drawing.points.map((p) => pt(p.x, p.y));
      const dStr = pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');
      return (
        <g opacity={opacity} onPointerDown={onPointerDown} className="cursor-move">
          <path d={dStr} fill="none" stroke="transparent" strokeWidth={18} />
          {isSelected && (
            <path
              data-editor-only="true"
              d={dStr}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={drawing.strokeWidth + 6}
              strokeOpacity={0.35}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <path
            d={dStr}
            fill="none"
            stroke={drawing.color}
            strokeWidth={drawing.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }

    case 'circle': {
      const c = pt(drawing.cx, drawing.cy);
      return (
        <g opacity={opacity} onPointerDown={onPointerDown} className="cursor-move">
          <circle
            cx={c.x}
            cy={c.y}
            r={drawing.r}
            fill={drawing.color}
            fillOpacity={drawing.fillOpacity}
            stroke={isSelected ? '#38bdf8' : drawing.color}
            strokeWidth={drawing.strokeWidth}
          />
        </g>
      );
    }

    case 'rectangle':
    case 'highlight': {
      const p1 = pt(drawing.x, drawing.y);
      const p2 = pt(drawing.x + drawing.w, drawing.y + drawing.h);
      const rx = Math.min(p1.x, p2.x);
      const ry = Math.min(p1.y, p2.y);
      const rw = Math.abs(p2.x - p1.x);
      const rh = Math.abs(p2.y - p1.y);
      const isHighlight = drawing.type === 'highlight';
      return (
        <g opacity={opacity} onPointerDown={onPointerDown} className="cursor-move">
          <rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            rx={isHighlight ? 10 : 3}
            fill={drawing.color}
            fillOpacity={isHighlight ? Math.max(0.22, drawing.fillOpacity) : drawing.fillOpacity}
            stroke={isSelected ? '#38bdf8' : drawing.color}
            strokeWidth={isHighlight ? 1.8 : drawing.strokeWidth}
            strokeDasharray={isHighlight ? '7 5' : undefined}
          />
        </g>
      );
    }

    case 'ellipse-highlight': {
      const c = pt(drawing.cx, drawing.cy);
      const rx = orientation === 'horizontal' ? drawing.rx : drawing.ry;
      const ry = orientation === 'horizontal' ? drawing.ry : drawing.rx;
      return (
        <g opacity={opacity} onPointerDown={onPointerDown} className="cursor-move">
          <ellipse
            cx={c.x}
            cy={c.y}
            rx={rx}
            ry={ry}
            fill={drawing.color}
            fillOpacity={Math.max(0.22, drawing.fillOpacity)}
            stroke={isSelected ? '#38bdf8' : drawing.color}
            strokeWidth={drawing.strokeWidth}
            strokeDasharray="6 4"
          />
        </g>
      );
    }

    case 'text': {
      const c = pt(drawing.x, drawing.y);
      const boxW = Math.max(54, drawing.text.length * drawing.fontSize * 0.6 + 22);
      const boxH = drawing.fontSize * 1.65;
      return (
        <g
          transform={`translate(${c.x}, ${c.y})`}
          opacity={opacity}
          onPointerDown={onPointerDown}
          onDoubleClick={onDoubleClick}
          className="cursor-move"
        >
          <rect
            x={-boxW / 2}
            y={-boxH / 2}
            width={boxW}
            height={boxH}
            rx={6}
            fill="#070c13"
            fillOpacity={drawing.bgOpacity}
            stroke={isSelected ? '#38bdf8' : 'rgba(255,255,255,0.18)'}
            strokeWidth={isSelected ? 1.8 : 1}
          />
          <text
            x={0}
            y={1}
            textAnchor="middle"
            dominantBaseline="central"
            fill={drawing.color}
            fontSize={drawing.fontSize}
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {drawing.text}
          </text>
        </g>
      );
    }
  }
}

function HandleDot({
  x,
  y,
  accent = '#38bdf8',
  onPointerDown,
}: {
  x: number;
  y: number;
  accent?: string;
  onPointerDown: (e: PointerEvent) => void;
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r={6.5}
      fill="#090d12"
      stroke={accent}
      strokeWidth={2.4}
      onPointerDown={onPointerDown}
      className="cursor-pointer"
    />
  );
}

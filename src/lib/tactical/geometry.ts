import {
  PITCH_H,
  PITCH_W,
  type BallMarker,
  type BoardPlayer,
  type DrawingObject,
  type PitchOrientation,
  type PitchView,
  type Point,
  type TacticalScene,
} from './types';

export const PITCH_PAD = 42;

export interface ViewBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Maps logical pitch coords (0..1050, 0..680) to SVG display coords.
 * Horizontal: x -> x, y -> y
 * Vertical (home attacks bottom -> top): displayX = y, displayY = PITCH_W - x
 */
export function logicalToDisplay(
  p: Point,
  orientation: PitchOrientation,
): Point {
  if (orientation === 'horizontal') return { x: p.x, y: p.y };
  return { x: p.y, y: PITCH_W - p.x };
}

export function displayToLogical(
  p: Point,
  orientation: PitchOrientation,
): Point {
  if (orientation === 'horizontal') return { x: p.x, y: p.y };
  return { x: PITCH_W - p.y, y: p.x };
}

export function clampLogical(p: Point, margin = 24): Point {
  return {
    x: Math.max(-margin, Math.min(PITCH_W + margin, p.x)),
    y: Math.max(-margin, Math.min(PITCH_H + margin, p.y)),
  };
}

export function getPitchViewBox(
  view: PitchView,
  orientation: PitchOrientation,
): ViewBoxRect {
  let lx1 = -PITCH_PAD;
  let lx2 = PITCH_W + PITCH_PAD;
  const ly1 = -PITCH_PAD;
  const ly2 = PITCH_H + PITCH_PAD;

  if (view === 'half-left') {
    lx1 = -PITCH_PAD;
    lx2 = PITCH_W * 0.54;
  } else if (view === 'half-right') {
    lx1 = PITCH_W * 0.46;
    lx2 = PITCH_W + PITCH_PAD;
  }

  if (orientation === 'horizontal') {
    return { x: lx1, y: ly1, w: lx2 - lx1, h: ly2 - ly1 };
  }

  // Vertical: displayX = ly, displayY = PITCH_W - lx
  const dx1 = ly1;
  const dx2 = ly2;
  const dy1 = PITCH_W - lx2;
  const dy2 = PITCH_W - lx1;
  return { x: dx1, y: dy1, w: dx2 - dx1, h: dy2 - dy1 };
}

/**
 * Exact browser client coordinates -> logical pitch coordinates using SVG CTM.
 */
export function clientToLogical(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  orientation: PitchOrientation,
): Point {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: PITCH_W / 2, y: PITCH_H / 2 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const svgPt = pt.matrixTransform(ctm.inverse());
  return displayToLogical({ x: svgPt.x, y: svgPt.y }, orientation);
}

/**
 * Computes a nice default quadratic Bezier control point for a curved arrow.
 */
export function defaultCurveControlPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bendFactor = 0.22,
): Point {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular vector
  const nx = -dy / len;
  const ny = dx / len;
  const offset = Math.min(130, len * bendFactor);
  return { x: mx + nx * offset, y: my + ny * offset };
}

/**
 * Ramer-Douglas-Peucker simplification for smooth freehand paths.
 */
export function simplifyPoints(points: Point[], tolerance = 2.5): Point[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, index + 1), tolerance);
    const right = simplifyPoints(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

export function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function getDrawingBounds(d: DrawingObject): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  switch (d.type) {
    case 'line':
    case 'arrow':
    case 'dashed-arrow':
      return {
        minX: Math.min(d.x1, d.x2),
        minY: Math.min(d.y1, d.y2),
        maxX: Math.max(d.x1, d.x2),
        maxY: Math.max(d.y1, d.y2),
      };
    case 'curved-arrow':
      return {
        minX: Math.min(d.x1, d.x2, d.cx),
        minY: Math.min(d.y1, d.y2, d.cy),
        maxX: Math.max(d.x1, d.x2, d.cx),
        maxY: Math.max(d.y1, d.y2, d.cy),
      };
    case 'freehand': {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const pt of d.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
      return Number.isFinite(minX)
        ? { minX, minY, maxX, maxY }
        : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    case 'circle':
      return {
        minX: d.cx - d.r,
        minY: d.cy - d.r,
        maxX: d.cx + d.r,
        maxY: d.cy + d.r,
      };
    case 'rectangle':
    case 'highlight':
      return {
        minX: Math.min(d.x, d.x + d.w),
        minY: Math.min(d.y, d.y + d.h),
        maxX: Math.max(d.x, d.x + d.w),
        maxY: Math.max(d.y, d.y + d.h),
      };
    case 'ellipse-highlight':
      return {
        minX: d.cx - d.rx,
        minY: d.cy - d.ry,
        maxX: d.cx + d.rx,
        maxY: d.cy + d.ry,
      };
    case 'text': {
      const approxW = Math.max(40, d.text.length * d.fontSize * 0.58);
      const approxH = d.fontSize * 1.4;
      return {
        minX: d.x - approxW / 2,
        minY: d.y - approxH / 2,
        maxX: d.x + approxW / 2,
        maxY: d.y + approxH / 2,
      };
    }
  }
}

export function rectsIntersect(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
}

export function translateDrawing(
  d: DrawingObject,
  dx: number,
  dy: number,
): DrawingObject {
  switch (d.type) {
    case 'line':
    case 'arrow':
    case 'dashed-arrow':
      return {
        ...d,
        x1: d.x1 + dx,
        y1: d.y1 + dy,
        x2: d.x2 + dx,
        y2: d.y2 + dy,
      };
    case 'curved-arrow':
      return {
        ...d,
        x1: d.x1 + dx,
        y1: d.y1 + dy,
        cx: d.cx + dx,
        cy: d.cy + dy,
        x2: d.x2 + dx,
        y2: d.y2 + dy,
      };
    case 'freehand':
      return {
        ...d,
        points: d.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
      };
    case 'circle':
      return { ...d, cx: d.cx + dx, cy: d.cy + dy };
    case 'rectangle':
    case 'highlight':
      return { ...d, x: d.x + dx, y: d.y + dy };
    case 'ellipse-highlight':
      return { ...d, cx: d.cx + dx, cy: d.cy + dy };
    case 'text':
      return { ...d, x: d.x + dx, y: d.y + dy };
  }
}

export function hitTestDrawing(d: DrawingObject, p: Point, tol = 14): boolean {
  switch (d.type) {
    case 'line':
    case 'arrow':
    case 'dashed-arrow':
      return (
        pointToSegmentDistance(p, { x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }) <=
        tol + d.strokeWidth
      );
    case 'curved-arrow': {
      // Sample quadratic Bezier at 16 points
      let prev = { x: d.x1, y: d.y1 };
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const u = 1 - t;
        const curr = {
          x: u * u * d.x1 + 2 * u * t * d.cx + t * t * d.x2,
          y: u * u * d.y1 + 2 * u * t * d.cy + t * t * d.y2,
        };
        if (pointToSegmentDistance(p, prev, curr) <= tol + d.strokeWidth) {
          return true;
        }
        prev = curr;
      }
      return false;
    }
    case 'freehand': {
      for (let i = 1; i < d.points.length; i++) {
        if (
          pointToSegmentDistance(p, d.points[i - 1], d.points[i]) <=
          tol + d.strokeWidth
        ) {
          return true;
        }
      }
      return false;
    }
    case 'circle': {
      const dist = Math.hypot(p.x - d.cx, p.y - d.cy);
      if (d.fillOpacity > 0.05) return dist <= d.r + tol;
      return Math.abs(dist - d.r) <= tol + d.strokeWidth;
    }
    case 'rectangle':
    case 'highlight': {
      const minX = Math.min(d.x, d.x + d.w);
      const maxX = Math.max(d.x, d.x + d.w);
      const minY = Math.min(d.y, d.y + d.h);
      const maxY = Math.max(d.y, d.y + d.h);
      if (d.type === 'highlight' || d.fillOpacity > 0.05) {
        return (
          p.x >= minX - tol &&
          p.x <= maxX + tol &&
          p.y >= minY - tol &&
          p.y <= maxY + tol
        );
      }
      const nearH =
        p.x >= minX - tol &&
        p.x <= maxX + tol &&
        (Math.abs(p.y - minY) <= tol || Math.abs(p.y - maxY) <= tol);
      const nearV =
        p.y >= minY - tol &&
        p.y <= maxY + tol &&
        (Math.abs(p.x - minX) <= tol || Math.abs(p.x - maxX) <= tol);
      return nearH || nearV;
    }
    case 'ellipse-highlight': {
      if (d.rx < 2 || d.ry < 2) return false;
      const nx = (p.x - d.cx) / (d.rx + tol);
      const ny = (p.y - d.cy) / (d.ry + tol);
      return nx * nx + ny * ny <= 1;
    }
    case 'text': {
      const b = getDrawingBounds(d);
      return (
        p.x >= b.minX - tol &&
        p.x <= b.maxX + tol &&
        p.y >= b.minY - tol &&
        p.y <= b.maxY + tol
      );
    }
  }
}

export function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export interface InterpolatedFrame {
  players: BoardPlayer[];
  balls: BallMarker[];
  drawings: (DrawingObject & { _renderOpacity?: number })[];
  trails: {
    id: string;
    team: 'home' | 'away';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }[];
}

/**
 * Smoothly interpolates player & ball positions and cross-fades drawings
 * between two consecutive tactical scenes.
 */
export function interpolateScenes(
  from: TacticalScene,
  to: TacticalScene,
  rawT: number,
): InterpolatedFrame {
  const t = easeInOutCubic(rawT);
  const toById = new Map(to.players.map((p) => [p.id, p]));
  const fromIds = new Set(from.players.map((p) => p.id));

  const players: BoardPlayer[] = [];
  const trails: InterpolatedFrame['trails'] = [];

  for (const fp of from.players) {
    const tp = toById.get(fp.id);
    if (tp) {
      const x = fp.x + (tp.x - fp.x) * t;
      const y = fp.y + (tp.y - fp.y) * t;
      const size = fp.size + (tp.size - fp.size) * t;
      players.push({ ...tp, x, y, size });
      if (Math.hypot(tp.x - fp.x, tp.y - fp.y) > 8) {
        trails.push({
          id: fp.id,
          team: fp.team,
          x1: fp.x,
          y1: fp.y,
          x2: x,
          y2: y,
        });
      }
    } else if (t < 0.5) {
      players.push(fp);
    }
  }

  for (const tp of to.players) {
    if (!fromIds.has(tp.id) && t >= 0.5) {
      players.push(tp);
    }
  }

  const toBalls = new Map(to.balls.map((b) => [b.id, b]));
  const fromBallIds = new Set(from.balls.map((b) => b.id));
  const balls: BallMarker[] = [];

  for (const fb of from.balls) {
    const tb = toBalls.get(fb.id);
    if (tb) {
      balls.push({
        ...tb,
        x: fb.x + (tb.x - fb.x) * t,
        y: fb.y + (tb.y - fb.y) * t,
      });
    } else if (t < 0.5) {
      balls.push(fb);
    }
  }
  for (const tb of to.balls) {
    if (!fromBallIds.has(tb.id) && t >= 0.5) {
      balls.push(tb);
    }
  }

  // Drawings cross-fade cleanly across midpoint
  const drawings: InterpolatedFrame['drawings'] = [];
  const fromDrawIds = new Set(from.drawings.map((d) => d.id));
  const toDrawIds = new Set(to.drawings.map((d) => d.id));

  for (const fd of from.drawings) {
    if (toDrawIds.has(fd.id)) {
      drawings.push(fd);
    } else if (rawT < 0.55) {
      drawings.push({
        ...fd,
        _renderOpacity: fd.opacity * Math.max(0, 1 - rawT / 0.55),
      });
    }
  }
  for (const td of to.drawings) {
    if (!fromDrawIds.has(td.id) && rawT > 0.35) {
      drawings.push({
        ...td,
        _renderOpacity: td.opacity * Math.min(1, (rawT - 0.35) / 0.65),
      });
    }
  }

  return { players, balls, drawings, trails };
}

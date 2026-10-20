import { getStroke } from 'perfect-freehand';
import type { Point, Stroke } from '../types';

export const FONT_FAMILY = 'MPLUS1p';
export const FONT_URL = '/fonts/MPLUS1p-Regular.ttf';
export const LINE_HEIGHT = 1.25;

export function strokeOptions(s: Pick<Stroke, 'kind' | 'size' | 'simulatePressure'>, last = true) {
  if (s.kind === 'highlighter') {
    return {
      size: s.size,
      thinning: 0,
      smoothing: 0.6,
      streamline: 0.5,
      simulatePressure: false,
      start: { cap: false },
      end: { cap: false },
      last,
    };
  }
  return {
    size: s.size,
    thinning: 0.65,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: s.simulatePressure,
    last,
  };
}

/** Đường bao (polygon) của nét bút sau khi áp dụng lực nhấn */
export function strokeOutline(s: Pick<Stroke, 'kind' | 'size' | 'simulatePressure' | 'points'>, last = true): number[][] {
  const pts = s.points.map((p) => [p[0], p[1], p[2]]);
  return getStroke(pts, strokeOptions(s, last));
}

const avg = (a: number, b: number) => (a + b) / 2;
const f = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Chuyển polygon thành SVG path (dùng lệnh Q tường minh để pdf-lib cũng đọc được).
 * mapY cho phép lật trục Y khi xuất PDF.
 */
export function outlineToPath(points: number[][], map?: (x: number, y: number) => [number, number]): string {
  const len = points.length;
  if (len < 3) return '';
  const P = map ? points.map((p) => map(p[0], p[1])) : points.map((p) => [p[0], p[1]] as [number, number]);
  let d = `M${f(P[0][0])},${f(P[0][1])}`;
  for (let i = 1; i < len; i++) {
    const a = P[i];
    const b = P[(i + 1) % len];
    d += ` Q${f(a[0])},${f(a[1])} ${f(avg(a[0], b[0]))},${f(avg(a[1], b[1]))}`;
  }
  return d + ' Z';
}

export function strokePath(s: Stroke): string {
  return outlineToPath(strokeOutline(s));
}

/** Vẽ một nét lên canvas 2D (dùng cho lớp mực "live" độ trễ thấp) */
export function drawStrokeToCanvas(ctx: CanvasRenderingContext2D, s: Pick<Stroke, 'kind' | 'size' | 'simulatePressure' | 'points' | 'color'>, last = false) {
  const outline = strokeOutline(s, last);
  if (outline.length < 3) return;
  const path = new Path2D(outlineToPath(outline));
  ctx.save();
  ctx.fillStyle = s.color;
  ctx.globalAlpha = s.kind === 'highlighter' ? 0.35 : 1;
  ctx.fill(path);
  ctx.restore();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function pointsBBox(points: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  return { minX, minY, maxX, maxY };
}

import type { Point, Rect, Stroke, TextItem } from '../types';
import { FONT_FAMILY, LINE_HEIGHT, pointsBBox, uid } from './ink';

export function strokesRect(strokes: Stroke[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    const b = pointsBBox(s.points);
    const pad = s.size / 2;
    minX = Math.min(minX, b.minX - pad);
    minY = Math.min(minY, b.minY - pad);
    maxX = Math.max(maxX, b.maxX + pad);
    maxY = Math.max(maxY, b.maxY + pad);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(fontSize: number): CanvasRenderingContext2D {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  const ctx = measureCtx!;
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  return ctx;
}

export function measureText(text: string, fontSize: number): { w: number; h: number } {
  const ctx = getMeasureCtx(fontSize);
  const lines = text.split('\n');
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l || ' ').width);
  return { w, h: lines.length * fontSize * LINE_HEIGHT };
}

export function textRect(t: TextItem): Rect {
  const m = measureText(t.text, t.fontSize);
  return { x: t.x, y: t.y, w: Math.max(m.w, t.fontSize * 0.5), h: m.h };
}

const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

export function splitGraphemes(str: string): string[] {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(str), (s) => s.segment);
  }
  return Array.from(str);
}

/**
 * Xoá một phần ký tự trong TextItem nằm dưới vùng eraseRect (dùng cho cả gạch zig-zag Scratch-out và Tẩy).
 * - Nếu chỉ gạch lên một vài chữ ở đầu/cuối câu: chỉ xoá đúng những chữ đó, giữ nguyên phần còn lại tại vị trí cũ.
 * - Nếu gạch ở giữa câu: tách thành 2 khối chữ hai bên đúng vị trí để có thể viết từ mới vào khoảng trống.
 */
export function eraseTextByRect(t: TextItem, eraseRect: Rect): { hit: boolean; items: TextItem[] } {
  const box = textRect(t);
  if (!rectsIntersect(box, eraseRect)) return { hit: false, items: [t] };

  const ctx = getMeasureCtx(t.fontSize);
  const lines = t.text.split('\n');
  const lineH = t.fontSize * LINE_HEIGHT;
  const ex0 = eraseRect.x;
  const ex1 = eraseRect.x + eraseRect.w;
  const ey0 = eraseRect.y;
  const ey1 = eraseRect.y + eraseRect.h;

  let anyHit = false;
  const pieces: { text: string; x: number; y: number }[] = [];

  lines.forEach((line, lineIdx) => {
    const ly0 = t.y + lineIdx * lineH;
    const ly1 = ly0 + lineH;
    const overlapY = Math.min(ly1, ey1) - Math.max(ly0, ey0);
    const vHit = overlapY > Math.min(lineH, Math.max(eraseRect.h, 4)) * 0.2;

    if (!vHit) {
      if (line.trim()) pieces.push({ text: line, x: t.x, y: ly0 });
      return;
    }

    const segs = splitGraphemes(line);
    let prefix = '';
    const chars = segs.map((ch) => {
      const x0 = t.x + ctx.measureText(prefix).width;
      prefix += ch;
      const x1 = t.x + ctx.measureText(prefix).width;
      const cw = Math.max(1, x1 - x0);
      const ox = Math.min(x1, ex1) - Math.max(x0, ex0);
      const cx = (x0 + x1) / 2;
      const hit = (cx >= ex0 && cx <= ex1) || ox >= cw * 0.35;
      return { ch, x0, x1, hit };
    });

    if (!chars.some((c) => c.hit)) {
      if (line.trim()) pieces.push({ text: line, x: t.x, y: ly0 });
      return;
    }

    anyHit = true;
    let i = 0;
    while (i < chars.length) {
      while (i < chars.length && chars[i].hit) i++;
      if (i >= chars.length) break;
      let j = i;
      while (j < chars.length && !chars[j].hit) j++;
      let s = i;
      let e = j - 1;
      while (s <= e && /^\s+$/.test(chars[s].ch)) s++;
      while (e >= s && /^\s+$/.test(chars[e].ch)) e--;
      if (s <= e) {
        const runText = chars
          .slice(s, e + 1)
          .map((c) => c.ch)
          .join('');
        pieces.push({ text: runText, x: chars[s].x0, y: ly0 });
      }
      i = j;
    }
  });

  if (!anyHit) return { hit: false, items: [t] };

  const items: TextItem[] = pieces.map((p, idx) => ({
    ...t,
    id: idx === 0 ? t.id : uid(),
    x: p.x,
    y: p.y,
    text: p.text,
    candidates: [],
    sourceStrokes: undefined,
  }));

  return { hit: true, items };
}

function countReversals(pts: Point[], axis: 0 | 1, minAmp: number): number {
  let dir = 0;
  let lo = pts[0][axis];
  let hi = lo;
  let ext = lo;
  let reversals = 0;
  for (const p of pts) {
    const v = p[axis];
    if (dir === 0) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      if (v - lo > minAmp) {
        dir = 1;
        ext = v;
      } else if (hi - v > minAmp) {
        dir = -1;
        ext = v;
      }
    } else if (dir === 1) {
      if (v > ext) ext = v;
      else if (ext - v > minAmp) {
        dir = -1;
        ext = v;
        reversals++;
      }
    } else {
      if (v < ext) ext = v;
      else if (v - ext > minAmp) {
        dir = 1;
        ext = v;
        reversals++;
      }
    }
  }
  return reversals;
}

/**
 * Nhận diện cử chỉ "gạch xoá" (scratch-out) kiểu iPad:
 * hỗ trợ cả gạch qua lại ngang (===) lẫn gạch răng cưa lên xuống (/\/\/\).
 */
export function isScratchOut(s: Stroke): boolean {
  const pts = s.points;
  if (pts.length < 10) return false;
  const b = pointsBBox(pts);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  if (w < 5 && h < 5) return false;
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const revX = countReversals(pts, 0, Math.max(3, Math.min(w * 0.25, 18)));
  const revY = countReversals(pts, 1, Math.max(3, Math.min(h * 0.35, 18)));
  const span = Math.max(w, h);
  return (revX >= 3 || revY >= 4) && L > 2.4 * span;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function strokeHit(s: Stroke, x: number, y: number, r: number): boolean {
  const pts = s.points;
  const rr = r + s.size / 2;
  if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][1] - y) <= rr;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= rr) return true;
  }
  return false;
}

export function rectHit(rc: Rect, x: number, y: number, r = 0): boolean {
  return x >= rc.x - r && x <= rc.x + rc.w + r && y >= rc.y - r && y <= rc.y + rc.h + r;
}

/**
 * Nét mới có thuộc cùng "cụm chữ" đang chờ nhận diện không?
 * Nếu người dùng xuống dòng / viết sang chỗ khác → nhận diện cụm cũ ngay.
 */
export function belongsToGroup(group: Rect, x: number, y: number): boolean {
  const h = Math.max(group.h, 18);
  const inY = y >= group.y - h * 0.9 && y <= group.y + group.h + h * 0.9;
  const inX = x >= group.x - h * 2.5 && x <= group.x + group.w + h * 4;
  return inY && inX;
}

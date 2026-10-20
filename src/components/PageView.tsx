import { memo, useEffect, useRef, useState } from 'react';
import type { Page, Point, Stroke } from '../types';
import { updatePage, useStore } from '../store';
import { drawStrokeToCanvas, strokePath, uid } from '../lib/ink';
import { eraseTextByRect, strokeHit } from '../lib/geometry';
import { scribbleStrokeEnd, scribbleStrokeStart } from '../lib/scribble';
import { TextBox } from './TextBox';
import { TextActions } from './TextActions';

type Gesture =
  | { mode: 'ink' | 'scribble'; pointerId: number; stroke: Stroke }
  | { mode: 'erase'; pointerId: number }
  | { mode: 'pan'; pointerId: number; lastX: number; lastY: number };

let lastInfoAt = 0;
function reportPen(e: React.PointerEvent) {
  const now = performance.now();
  if (now - lastInfoAt < 60) return;
  lastInfoAt = now;
  useStore.getState().set({ penInfo: { type: e.pointerType, pressure: e.pressure, buttons: e.buttons } });
}

const StrokeSvg = memo(function StrokeSvg({ s, opacity = 1 }: { s: Stroke; opacity?: number }) {
  return (
    <path
      d={strokePath(s)}
      fill={s.color}
      opacity={(s.kind === 'highlighter' ? 0.35 : 1) * opacity}
      style={s.kind === 'highlighter' ? { mixBlendMode: 'multiply' } : undefined}
    />
  );
});

export const PageView = memo(function PageView({ page, index }: { page: Page; index: number }) {
  const zoom = useStore((s) => s.zoom);
  const pdfDoc = useStore((s) => s.pdfDoc);
  const tool = useStore((s) => s.tool);
  const ruled = useStore((s) => s.settings.ruled);
  const pending = useStore((s) => (s.pending?.pageId === page.id ? s.pending : null));
  const recognizing = useStore((s) => s.recognizing);
  const lastConverted = useStore((s) => (s.lastConverted?.pageId === page.id ? s.lastConverted : null));
  const selected = useStore((s) => (s.selected?.pageId === page.id ? s.selected : null));
  const editing = useStore((s) => (s.editing?.pageId === page.id ? s.editing : null));

  const wrapRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const raf = useRef<number>(0);
  const [visible, setVisible] = useState(index < 2);

  const W = page.width;
  const H = page.height;

  // Chỉ render trang PDF khi trang nằm trong vùng nhìn thấy
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || page.pdfIndex === null || !pdfDoc) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    const t = window.setTimeout(async () => {
      try {
        const p = await pdfDoc.getPage(page.pdfIndex! + 1);
        if (cancelled) return;
        const dpr = window.devicePixelRatio || 1;
        const vp = p.getViewport({ scale: zoom * dpr });
        const off = document.createElement('canvas');
        off.width = Math.floor(vp.width);
        off.height = Math.floor(vp.height);
        task = p.render({ canvas: off, viewport: vp });
        await task.promise;
        if (cancelled) return;
        const c = pdfCanvasRef.current!;
        c.width = off.width;
        c.height = off.height;
        c.getContext('2d')!.drawImage(off, 0, 0);
      } catch {
        /* render bị huỷ */
      }
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      task?.cancel();
    };
  }, [visible, zoom, pdfDoc, page.pdfIndex]);

  // Kích thước canvas mực "live"
  useEffect(() => {
    const c = liveRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.ceil(W * zoom * dpr);
    c.height = Math.ceil(H * zoom * dpr);
  }, [W, H, zoom]);

  const toPage = (clientX: number, clientY: number): [number, number] => {
    const r = wrapRef.current!.getBoundingClientRect();
    return [(clientX - r.left) / zoom, (clientY - r.top) / zoom];
  };

  const drawLive = () => {
    raf.current = 0;
    const c = liveRef.current;
    const g = gesture.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!g || (g.mode !== 'ink' && g.mode !== 'scribble')) return;
    const k = zoom * (window.devicePixelRatio || 1);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawStrokeToCanvas(ctx, g.stroke, false);
  };
  const scheduleDraw = () => {
    if (!raf.current) raf.current = requestAnimationFrame(drawLive);
  };
  const clearLive = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    const c = liveRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
  };

  const eraseAt = (x: number, y: number) => {
    const r = 7 / Math.max(zoom, 0.5);
    const st = useStore.getState();
    const pg = st.pages.find((p) => p.id === page.id);
    if (!pg) return;
    const sHit = pg.strokes.filter((s) => strokeHit(s, x, y, r));
    const eraseBox = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
    let textChanged = false;
    const nextTexts: typeof pg.texts = [];
    for (const t of pg.texts) {
      const res = eraseTextByRect(t, eraseBox);
      if (res.hit) textChanged = true;
      nextTexts.push(...res.items);
    }
    if (!sHit.length && !textChanged) return;
    const sIds = new Set(sHit.map((s) => s.id));
    st.mutate((pages) =>
      updatePage(pages, page.id, (p) => ({
        ...p,
        strokes: p.strokes.filter((s) => !sIds.has(s.id)),
        texts: textChanged ? nextTexts : p.texts,
      })),
    );
  };

  const makePoint = (e: PointerEvent | React.PointerEvent): Point => {
    const [x, y] = toPage(e.clientX, e.clientY);
    const pressure = e.pointerType === 'pen' ? Math.max(0.05, e.pressure) : 0.5;
    return [x, y, pressure, e.timeStamp];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    reportPen(e);
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (gesture.current) return;
    const st = useStore.getState();
    if (st.editing) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    st.set({ lastConverted: null, selected: null });
    const [x, y] = toPage(e.clientX, e.clientY);
    // Nút tẩy (đuôi bút) hoặc nút bên thân bút XP-Pen → tẩy tạm thời
    const barrelErase = e.pointerType === 'pen' && ((e.buttons & 32) !== 0 || (e.buttons & 2) !== 0);
    wrapRef.current!.setPointerCapture(e.pointerId);
    e.preventDefault();

    if (tool === 'eraser' || barrelErase) {
      st.snapshot();
      gesture.current = { mode: 'erase', pointerId: e.pointerId };
      eraseAt(x, y);
      return;
    }
    if (tool === 'select') {
      gesture.current = { mode: 'pan', pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      return;
    }
    const kind = tool === 'highlighter' ? 'highlighter' : 'pen';
    const stroke: Stroke = {
      id: uid(),
      kind,
      color: kind === 'highlighter' ? '#ffd400' : st.color,
      size: kind === 'highlighter' ? 14 : st.penSize,
      simulatePressure: e.pointerType !== 'pen',
      points: [makePoint(e)],
    };
    if (tool === 'scribble') scribbleStrokeStart(page.id, x, y);
    gesture.current = { mode: tool === 'scribble' ? 'scribble' : 'ink', pointerId: e.pointerId, stroke };
    scheduleDraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    reportPen(e);
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const native = e.nativeEvent;
    const events = (native.getCoalescedEvents?.() ?? []).length ? native.getCoalescedEvents() : [native];
    if (g.mode === 'erase') {
      for (const ev of events) {
        const [x, y] = toPage(ev.clientX, ev.clientY);
        eraseAt(x, y);
      }
      return;
    }
    if (g.mode === 'pan') {
      const sc = wrapRef.current!.closest('.scroller');
      sc?.scrollBy(g.lastX - e.clientX, g.lastY - e.clientY);
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      return;
    }
    for (const ev of events) g.stroke.points.push(makePoint(ev));
    scheduleDraw();
  };

  const finish = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    if (g.mode === 'ink') {
      useStore.getState().commit((pages) => updatePage(pages, page.id, (p) => ({ ...p, strokes: [...p.strokes, g.stroke] })));
    } else if (g.mode === 'scribble') {
      scribbleStrokeEnd(page.id, g.stroke);
    }
    clearLive();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'select') return;
    // Nhấp đúp vào chỗ trống → thêm chữ bằng bàn phím
    const [x, y] = toPage(e.clientX, e.clientY);
    const st = useStore.getState();
    const id = uid();
    const fontSize = 14;
    st.commit((pages) =>
      updatePage(pages, page.id, (p) => ({
        ...p,
        texts: [...p.texts, { id, x, y: y - fontSize * 0.6, fontSize, text: '', color: st.color, lang: st.lang, candidates: [] }],
      })),
    );
    st.set({ selected: { pageId: page.id, textId: id }, editing: { pageId: page.id, textId: id } });
  };

  const recogHere = recognizing.filter((r) => r.pageId === page.id);
  const actionText =
    (editing ? null : selected && page.texts.find((t) => t.id === selected.textId)) ||
    (lastConverted && page.texts.find((t) => t.id === lastConverted.textId)) ||
    null;

  return (
    <div className="page-shell">
      <div className="page-label">
        Trang {index + 1}
        {page.pdfIndex === null ? ' · giấy trắng' : ''}
      </div>
      <div
        ref={wrapRef}
        className={`page tool-${tool}`}
        style={{ width: W * zoom, height: H * zoom }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {page.pdfIndex !== null ? (
          <canvas ref={pdfCanvasRef} className="layer pdf-layer" />
        ) : (
          ruled && <div className="layer ruled" style={{ backgroundSize: `100% ${28 * zoom}px`, backgroundPositionY: `${60 * zoom}px` }} />
        )}
        <div className="layer content" style={{ width: W, height: H, transform: `scale(${zoom})` }}>
          <svg className="layer ink" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            {page.strokes.map((s) => (
              <StrokeSvg key={s.id} s={s} />
            ))}
            {pending?.strokes.map((s) => (
              <StrokeSvg key={s.id} s={s} />
            ))}
            {recogHere.flatMap((r) => r.strokes.map((s) => <StrokeSvg key={s.id} s={s} opacity={0.35} />))}
          </svg>
          {page.texts.map((t) => (
            <TextBox
              key={t.id}
              pageId={page.id}
              t={t}
              interactive={tool === 'select'}
              isSelected={selected?.textId === t.id}
              isEditing={editing?.textId === t.id}
              fresh={lastConverted?.textId === t.id}
            />
          ))}
        </div>
        <canvas ref={liveRef} className="layer live" />
        {actionText && <TextActions pageId={page.id} t={actionText} zoom={zoom} full={!!selected} />}
      </div>
    </div>
  );
});

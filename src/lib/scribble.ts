/**
 * Bộ điều khiển "Scribble" – mô phỏng iPad:
 *  - Viết bằng bút → nhấc bút → sau ~0.7s nét mực tự biến thành chữ gõ máy tại chỗ.
 *  - Viết tiếp ngay bên phải một dòng chữ đã có → nối thêm vào dòng đó.
 *  - Gạch zig-zag lên từ/ký tự nào → chỉ xoá đúng những từ/ký tự nằm dưới nét gạch.
 */
import type { Page, Stroke, TextItem } from '../types';
import { findText, updatePage, useStore } from '../store';
import { belongsToGroup, eraseTextByRect, intersectionArea, isScratchOut, strokesRect, textRect } from './geometry';
import { LINE_HEIGHT, uid } from './ink';
import { recognizeInk } from './recognizer';

let timer: number | undefined;

function clearTimer() {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
}

/** Gọi khi đặt bút xuống ở chế độ Scribble */
export function scribbleStrokeStart(pageId: string, x: number, y: number) {
  clearTimer();
  const { pending } = useStore.getState();
  if (pending && (pending.pageId !== pageId || !belongsToGroup(strokesRect(pending.strokes), x, y))) {
    void flush();
  }
}

/** Gọi khi nhấc bút ở chế độ Scribble */
export function scribbleStrokeEnd(pageId: string, stroke: Stroke) {
  const st = useStore.getState();
  const pending = st.pending && st.pending.pageId === pageId ? st.pending : { pageId, strokes: [] };
  const nextStrokes = [...pending.strokes, stroke];
  st.set({ pending: { pageId, strokes: nextStrokes } });
  clearTimer();
  // Nếu là cử chỉ gạch xoá zig-zag thì phản hồi nhanh (~220ms) thay vì chờ hết scribbleDelay
  const delay = nextStrokes.every(isScratchOut) ? Math.min(220, st.settings.scribbleDelay) : st.settings.scribbleDelay;
  timer = window.setTimeout(() => void flush(), delay);
}

/** Chuyển ngay cụm nét đang chờ (vd. khi đổi công cụ) */
export function flushNow() {
  clearTimer();
  void flush();
}

function sepFor(lang: string, left: string, right: string) {
  if (lang === 'ja') return '';
  if (!left || /\s$/.test(left) || /^[.,!?;:)\]}%…]/.test(right)) return '';
  return ' ';
}

function findAppendTarget(page: Page, ink: { x: number; y: number; w: number; h: number }): TextItem | undefined {
  let best: TextItem | undefined;
  let bestGap = Infinity;
  for (const t of page.texts) {
    const r = textRect(t);
    const lines = t.text.split('\n').length;
    // chỉ xét dòng cuối của khối chữ
    const lineTop = r.y + (lines - 1) * t.fontSize * LINE_HEIGHT;
    const lineH = t.fontSize * LINE_HEIGHT;
    const overlapY = Math.min(lineTop + lineH, ink.y + ink.h) - Math.max(lineTop, ink.y);
    if (overlapY < Math.min(lineH, ink.h) * 0.45) continue;
    const lastLineW = r.w;
    const right = r.x + lastLineW;
    const gap = ink.x - right;
    if (gap > -t.fontSize * 0.6 && gap < t.fontSize * 1.6 && gap < bestGap) {
      best = t;
      bestGap = gap;
    }
  }
  return best;
}

async function flush() {
  clearTimer();
  const st = useStore.getState();
  const job = st.pending;
  if (!job || !job.strokes.length) return;
  st.set({ pending: null, recognizing: [...st.recognizing, job] });
  const done = () => {
    const s = useStore.getState();
    s.set({ recognizing: s.recognizing.filter((r) => r !== job) });
  };

  const page = st.pages.find((p) => p.id === job.pageId);
  if (!page) return done();
  const ink = strokesRect(job.strokes);

  // 1) Cử chỉ gạch xoá (xoá chính xác từng ký tự / từ nằm dưới vùng gạch)
  if (job.strokes.every(isScratchOut)) {
    const padY = Math.max(3, ink.h * 0.12);
    const eraseBox = { x: ink.x, y: ink.y - padY, w: ink.w, h: ink.h + padY * 2 };
    let textChanged = false;
    const nextTexts: TextItem[] = [];
    for (const t of page.texts) {
      const res = eraseTextByRect(t, eraseBox);
      if (res.hit) textChanged = true;
      nextTexts.push(...res.items);
    }
    const hitStrokes = page.strokes.filter((s) => {
      const r = strokesRect([s]);
      return intersectionArea(r, eraseBox) > r.w * r.h * 0.4;
    });
    if (textChanged || hitStrokes.length) {
      const sIds = new Set(hitStrokes.map((s) => s.id));
      useStore.getState().commit((pages) =>
        updatePage(pages, job.pageId, (p) => ({
          ...p,
          texts: nextTexts,
          strokes: p.strokes.filter((s) => !sIds.has(s.id)),
        })),
      );
      useStore.getState().set({ lastConverted: null, selected: null });
      return done();
    }
  }

  // 2) Nhận diện chữ
  const lang = st.lang;
  const target = findAppendTarget(page, ink);
  try {
    const { candidates } = await recognizeInk(job.strokes, lang, target?.text ?? '');
    if (!candidates.length) throw new Error('empty');
    const s = useStore.getState();
    const liveTarget = target ? findText(job.pageId, target.id) : undefined;
    if (liveTarget) {
      const base = liveTarget.text;
      const full = candidates.map((c) => base + sepFor(lang, base, c) + c);
      s.commit((pages) =>
        updatePage(pages, job.pageId, (p) => ({
          ...p,
          texts: p.texts.map((t) =>
            t.id === liveTarget.id
              ? { ...t, text: full[0], candidates: full, sourceStrokes: [...(t.sourceStrokes ?? []), ...job.strokes] }
              : t,
          ),
        })),
      );
      s.set({ lastConverted: { pageId: job.pageId, textId: liveTarget.id } });
    } else {
      const ratio = lang === 'ja' ? 0.85 : 0.7;
      const fontSize = Math.round(Math.min(120, Math.max(9, ink.h * ratio)) * 2) / 2;
      const item: TextItem = {
        id: uid(),
        x: ink.x,
        y: ink.y + ink.h / 2 - (fontSize * LINE_HEIGHT) / 2,
        fontSize,
        text: candidates[0],
        color: job.strokes[0].color,
        lang,
        candidates,
        sourceStrokes: job.strokes,
      };
      s.commit((pages) => updatePage(pages, job.pageId, (p) => ({ ...p, texts: [...p.texts, item] })));
      s.set({ lastConverted: { pageId: job.pageId, textId: item.id } });
    }
  } catch (e) {
    // Không nhận diện được → giữ lại nét mực để không mất nội dung
    const s = useStore.getState();
    s.commit((pages) => updatePage(pages, job.pageId, (p) => ({ ...p, strokes: [...p.strokes, ...job.strokes] })));
    s.showToast(navigator.onLine ? 'Không nhận diện được – đã giữ nét viết tay' : 'Mất kết nối mạng – đã giữ nét viết tay');
    console.warn(e);
  } finally {
    done();
  }
}

/** Đổi sang phương án nhận diện khác */
export function chooseCandidate(pageId: string, textId: string, text: string) {
  useStore.getState().commit((pages) =>
    updatePage(pages, pageId, (p) => ({ ...p, texts: p.texts.map((t) => (t.id === textId ? { ...t, text } : t)) })),
  );
}

/** Hoàn tác chữ gõ máy → trả lại nét viết tay gốc */
export function revertToInk(pageId: string, textId: string) {
  const t = findText(pageId, textId);
  if (!t?.sourceStrokes?.length) return;
  useStore.getState().commit((pages) =>
    updatePage(pages, pageId, (p) => ({
      ...p,
      texts: p.texts.filter((x) => x.id !== textId),
      strokes: [...p.strokes, ...t.sourceStrokes!],
    })),
  );
  useStore.getState().set({ lastConverted: null, selected: null });
}

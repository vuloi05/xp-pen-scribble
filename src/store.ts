import { create } from 'zustand';
import type { Lang, Page, Stroke, TextItem, Tool } from './types';
import type { PdfDoc } from './lib/pdf';
import { uid } from './lib/ink';

export const A4 = { width: 595, height: 842 };

export function blankPage(w = A4.width, h = A4.height): Page {
  return { id: uid(), width: w, height: h, pdfIndex: null, strokes: [], texts: [] };
}

export interface Pending {
  pageId: string;
  strokes: Stroke[];
}

export interface Settings {
  /** thời gian chờ sau khi nhấc bút trước khi chuyển thành chữ (ms) */
  scribbleDelay: number;
  /** hiện dòng kẻ trên trang trắng */
  ruled: boolean;
}

interface State {
  pages: Page[];
  past: Page[][];
  future: Page[][];
  fileName: string;
  pdfBytes: Uint8Array | null;
  pdfDoc: PdfDoc | null;

  tool: Tool;
  lang: Lang;
  color: string;
  penSize: number;
  zoom: number;
  settings: Settings;

  pending: Pending | null;
  recognizing: Pending[];
  lastConverted: { pageId: string; textId: string } | null;
  selected: { pageId: string; textId: string } | null;
  editing: { pageId: string; textId: string } | null;
  toast: string | null;
  penInfo: { type: string; pressure: number; buttons: number };

  set: (p: Partial<State>) => void;
  /** cập nhật trang + ghi lịch sử (undo) */
  commit: (fn: (pages: Page[]) => Page[]) => void;
  /** cập nhật trang không ghi lịch sử (dùng trong 1 cử chỉ đã gọi snapshot()) */
  mutate: (fn: (pages: Page[]) => Page[]) => void;
  snapshot: () => void;
  undo: () => void;
  redo: () => void;
  showToast: (msg: string) => void;
}

let toastTimer: number | undefined;

export const useStore = create<State>((set, get) => ({
  pages: [blankPage()],
  past: [],
  future: [],
  fileName: 'ghi-chu',
  pdfBytes: null,
  pdfDoc: null,

  tool: 'scribble',
  lang: 'vi',
  color: '#1f2a44',
  penSize: 2.2,
  zoom: 1,
  settings: { scribbleDelay: 700, ruled: true },

  pending: null,
  recognizing: [],
  lastConverted: null,
  selected: null,
  editing: null,
  toast: null,
  penInfo: { type: '-', pressure: 0, buttons: 0 },

  set: (p) => set(p),
  commit: (fn) => {
    const { pages, past } = get();
    set({ pages: fn(pages), past: [...past.slice(-99), pages], future: [] });
  },
  mutate: (fn) => set({ pages: fn(get().pages) }),
  snapshot: () => {
    const { pages, past } = get();
    set({ past: [...past.slice(-99), pages], future: [] });
  },
  undo: () => {
    const { past, pages, future } = get();
    if (!past.length) return;
    set({ pages: past[past.length - 1], past: past.slice(0, -1), future: [pages, ...future], lastConverted: null, selected: null, editing: null });
  },
  redo: () => {
    const { past, pages, future } = get();
    if (!future.length) return;
    set({ pages: future[0], future: future.slice(1), past: [...past, pages], lastConverted: null, selected: null, editing: null });
  },
  showToast: (msg) => {
    window.clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = window.setTimeout(() => set({ toast: null }), 2600);
  },
}));

export function updatePage(pages: Page[], pageId: string, fn: (p: Page) => Page): Page[] {
  return pages.map((p) => (p.id === pageId ? fn(p) : p));
}

export function updateText(pages: Page[], pageId: string, textId: string, fn: (t: TextItem) => TextItem): Page[] {
  return updatePage(pages, pageId, (p) => ({ ...p, texts: p.texts.map((t) => (t.id === textId ? fn(t) : t)) }));
}

export function findText(pageId: string, textId: string): TextItem | undefined {
  return useStore.getState().pages.find((p) => p.id === pageId)?.texts.find((t) => t.id === textId);
}

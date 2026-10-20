import { useCallback, useEffect, useRef, useState } from 'react';
import { blankPage, useStore } from './store';
import type { Lang, Page, Tool } from './types';
import { Toolbar } from './components/Toolbar';
import { PageView } from './components/PageView';
import { HelpDialog } from './components/HelpDialog';
import { StatusBar } from './components/StatusBar';
import { destroyPdf, getPageViewports, loadPdf } from './lib/pdf';
import { flushNow } from './lib/scribble';
import { FONT_FAMILY, uid } from './lib/ink';

const TOOL_KEYS: Record<string, Tool> = { s: 'scribble', p: 'pen', h: 'highlighter', e: 'eraser', v: 'select' };
const LANG_KEYS: Record<string, Lang> = { '1': 'vi', '2': 'en', '3': 'ja' };
const LANG_ORDER: Lang[] = ['vi', 'en', 'ja'];

export default function App() {
  const pages = useStore((s) => s.pages);
  const tool = useStore((s) => s.tool);
  const toast = useStore((s) => s.toast);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(() => !localStorage.getItem('inkpad.helpSeen'));
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    void document.fonts.load(`16px ${FONT_FAMILY}`);
  }, []);

  // Đổi công cụ → chuyển ngay cụm nét đang chờ
  useEffect(() => {
    if (tool !== 'scribble') flushNow();
  }, [tool]);

  const fitZoom = useCallback((list: Page[] = useStore.getState().pages) => {
    const sc = scrollerRef.current;
    if (!sc) return 1;
    const maxW = Math.max(...list.map((p) => p.width));
    return Math.max(0.4, Math.min(1.6, (sc.clientWidth - 64) / maxW));
  }, []);

  const setZoom = useCallback(
    (z: number | 'fit') => {
      const v = z === 'fit' ? fitZoom() : Math.max(0.3, Math.min(5, z));
      useStore.getState().set({ zoom: Math.round(v * 100) / 100 });
    },
    [fitZoom],
  );

  useEffect(() => {
    setZoom('fit');
  }, [setZoom]);

  const openFile = useCallback(
    async (file: File) => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await loadPdf(bytes);
        const vps = await getPageViewports(doc);
        const list: Page[] = vps.map((vp, i) => ({
          id: uid(),
          width: vp.width,
          height: vp.height,
          pdfIndex: i,
          strokes: [],
          texts: [],
        }));
        const old = useStore.getState().pdfDoc;
        useStore.getState().set({
          pdfDoc: doc,
          pdfBytes: bytes,
          pages: list,
          past: [],
          future: [],
          pending: null,
          lastConverted: null,
          selected: null,
          fileName: file.name.replace(/\.pdf$/i, ''),
          zoom: fitZoom(list),
        });
        destroyPdf(old);
        scrollerRef.current?.scrollTo({ top: 0 });
      } catch (e) {
        console.error(e);
        useStore.getState().showToast('Không mở được file PDF này');
      }
    },
    [fitZoom],
  );

  const newBlank = () => {
    const st = useStore.getState();
    const hasContent = st.pages.some((p) => p.strokes.length || p.texts.length);
    if (hasContent && !confirm('Tạo tài liệu mới? Nội dung chưa xuất sẽ bị mất.')) return;
    destroyPdf(st.pdfDoc);
    st.set({ pages: [blankPage()], pdfDoc: null, pdfBytes: null, past: [], future: [], fileName: 'ghi-chu', pending: null, lastConverted: null, selected: null });
  };

  const addPage = () => {
    const st = useStore.getState();
    const last = st.pages[st.pages.length - 1];
    st.commit((pages) => [...pages, blankPage(last?.width, last?.height)]);
    setTimeout(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  const doExport = async () => {
    flushNow();
    setBusy(true);
    try {
      // chờ các cụm đang nhận diện xong
      for (let i = 0; i < 40 && (useStore.getState().recognizing.length || useStore.getState().pending); i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const st = useStore.getState();
      const { exportPdf, downloadBytes } = await import('./lib/export');
      const bytes = await exportPdf(st.pages, st.pdfBytes, st.pdfDoc);
      downloadBytes(bytes, `${st.fileName}-da-ghi.pdf`);
      st.showToast('Đã xuất PDF');
    } catch (e) {
      console.error(e);
      useStore.getState().showToast('Xuất PDF thất bại: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    const { collectText, downloadBytes } = await import('./lib/export');
    const text = collectText(useStore.getState().pages);
    if (!text) return useStore.getState().showToast('Chưa có chữ gõ máy nào');
    try {
      await navigator.clipboard.writeText(text);
      useStore.getState().showToast('Đã sao chép toàn bộ chữ vào clipboard');
    } catch {
      downloadBytes(new TextEncoder().encode(text), `${useStore.getState().fileName}.txt`, 'text/plain');
    }
  };

  // Phím tắt – có thể gán vào 8 phím ExpressKey của XP-Pen Deco 640 trong driver
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      const st = useStore.getState();
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); st.undo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); st.redo(); }
        else if (k === 's') { e.preventDefault(); void doExport(); }
        else if (k === 'o') { e.preventDefault(); fileRef.current?.click(); }
        return;
      }
      if (e.altKey) return;
      if (TOOL_KEYS[k]) st.set({ tool: TOOL_KEYS[k] });
      else if (LANG_KEYS[k]) st.set({ lang: LANG_KEYS[k] });
      else if (k === 'l') st.set({ lang: LANG_ORDER[(LANG_ORDER.indexOf(st.lang) + 1) % 3] });
      else if (k === '+' || k === '=') setZoom(st.zoom * 1.15);
      else if (k === '-') setZoom(st.zoom / 1.15);
      else if (k === '0') setZoom('fit');
      else if ((k === 'delete' || k === 'backspace') && st.selected) {
        const sel = st.selected;
        st.commit((pages) => pages.map((p) => (p.id === sel.pageId ? { ...p, texts: p.texts.filter((t) => t.id !== sel.textId) } : p)));
        st.set({ selected: null });
      } else if (k === 'escape') st.set({ selected: null, lastConverted: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setZoom]);

  // Ctrl + lăn chuột = phóng to / thu nhỏ (zoom giữ điểm dưới con trỏ)
  useEffect(() => {
    const sc = scrollerRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const st = useStore.getState();
      const old = st.zoom;
      const next = Math.max(0.3, Math.min(5, old * Math.exp(-e.deltaY * 0.0015)));
      const r = sc.getBoundingClientRect();
      const ax = e.clientX - r.left + sc.scrollLeft;
      const ay = e.clientY - r.top + sc.scrollTop;
      st.set({ zoom: next });
      requestAnimationFrame(() => {
        sc.scrollLeft = ax * (next / old) - (e.clientX - r.left);
        sc.scrollTop = ay * (next / old) - (e.clientY - r.top);
      });
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f && /pdf$/i.test(f.type || f.name)) void openFile(f);
      }}
    >
      <Toolbar
        onOpen={() => fileRef.current?.click()}
        onNewBlank={newBlank}
        onAddPage={addPage}
        onExport={doExport}
        onCopyText={copyText}
        onZoom={setZoom}
        onHelp={() => setHelp(true)}
        busy={busy}
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openFile(f);
          e.target.value = '';
        }}
      />
      <main ref={scrollerRef} className="scroller">
        <div className="pages">
          {pages.map((p, i) => (
            <PageView key={p.id} page={p} index={i} />
          ))}
          <button className="add-page" onClick={addPage}>
            + Thêm trang trắng
          </button>
        </div>
      </main>
      <StatusBar />
      {toast && <div className="toast">{toast}</div>}
      {dragOver && <div className="drop-hint">Thả file PDF vào đây</div>}
      {help && (
        <HelpDialog
          onClose={() => {
            localStorage.setItem('inkpad.helpSeen', '1');
            setHelp(false);
          }}
        />
      )}
    </div>
  );
}

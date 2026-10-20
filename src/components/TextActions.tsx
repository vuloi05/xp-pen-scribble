import type { TextItem } from '../types';
import { updatePage, updateText, useStore } from '../store';
import { textRect } from '../lib/geometry';
import { chooseCandidate, revertToInk } from '../lib/scribble';

/** Thanh gợi ý phương án nhận diện + thao tác nhanh trên khối chữ */
export function TextActions({ pageId, t, zoom, full }: { pageId: string; t: TextItem; zoom: number; full: boolean }) {
  const r = textRect(t);
  const others = t.candidates.filter((c) => c !== t.text).slice(0, 6);
  const top = (r.y + r.h) * zoom + 6;

  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const st = useStore.getState;

  const resize = (k: number) =>
    st().commit((pages) =>
      updateText(pages, pageId, t.id, (x) => ({ ...x, fontSize: Math.max(6, Math.min(160, Math.round(x.fontSize * k * 2) / 2)) })),
    );
  const remove = () => {
    st().commit((pages) => updatePage(pages, pageId, (p) => ({ ...p, texts: p.texts.filter((x) => x.id !== t.id) })));
    st().set({ selected: null, lastConverted: null });
  };

  if (!full && !others.length && !t.sourceStrokes?.length) return null;

  return (
    <div className="text-actions" style={{ left: Math.max(0, r.x * zoom), top }} onPointerDown={stop} onDoubleClick={(e) => e.stopPropagation()}>
      {others.map((c) => (
        <button key={c} className="chip" title="Chọn phương án này" onClick={() => chooseCandidate(pageId, t.id, c)}>
          {c}
        </button>
      ))}
      {others.length > 0 && <span className="sep" />}
      {full && (
        <>
          <button className="chip ghost" title="Thu nhỏ chữ" onClick={() => resize(1 / 1.15)}>
            A−
          </button>
          <button className="chip ghost" title="Phóng to chữ" onClick={() => resize(1.15)}>
            A+
          </button>
          <button className="chip ghost" title="Sửa bằng bàn phím" onClick={() => st().set({ editing: { pageId, textId: t.id } })}>
            Sửa
          </button>
        </>
      )}
      {!!t.sourceStrokes?.length && (
        <button className="chip ghost" title="Trả lại nét viết tay gốc" onClick={() => revertToInk(pageId, t.id)}>
          ↶ Nét tay
        </button>
      )}
      {full ? (
        <button className="chip danger" title="Xoá" onClick={remove}>
          Xoá
        </button>
      ) : (
        <button className="chip ghost" title="Đóng" onClick={() => st().set({ lastConverted: null })}>
          ×
        </button>
      )}
    </div>
  );
}

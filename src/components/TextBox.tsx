import { memo, useEffect, useRef, useState } from 'react';
import type { TextItem } from '../types';
import { updatePage, updateText, useStore } from '../store';
import { FONT_FAMILY, LINE_HEIGHT } from '../lib/ink';
import { measureText } from '../lib/geometry';

interface Props {
  pageId: string;
  t: TextItem;
  interactive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  fresh: boolean;
}

export const TextBox = memo(function TextBox({ pageId, t, interactive, isSelected, isEditing, fresh }: Props) {
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const base: React.CSSProperties = {
    left: t.x,
    top: t.y,
    fontSize: t.fontSize,
    lineHeight: LINE_HEIGHT,
    color: t.color,
    fontFamily: FONT_FAMILY,
  };

  if (isEditing) return <TextEditor pageId={pageId} t={t} style={base} />;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    useStore.getState().set({ selected: { pageId, textId: t.id }, lastConverted: null });
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const zoom = useStore.getState().zoom;
    const dx = (e.clientX - d.sx) / zoom;
    const dy = (e.clientY - d.sy) / zoom;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 2) return;
      d.moved = true;
      useStore.getState().snapshot();
    }
    useStore.getState().mutate((pages) => updateText(pages, pageId, t.id, (x) => ({ ...x, x: d.ox + dx, y: d.oy + dy })));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  return (
    <div
      className={`text-item${interactive ? ' interactive' : ''}${isSelected ? ' selected' : ''}${fresh ? ' fresh' : ''}`}
      style={base}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        useStore.getState().set({ editing: { pageId, textId: t.id } });
      }}
    >
      {t.text}
    </div>
  );
});

function TextEditor({ pageId, t, style }: { pageId: string; t: TextItem; style: React.CSSProperties }) {
  const [value, setValue] = useState(t.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const m = measureText(value || ' ', t.fontSize);

  const done = () => {
    const st = useStore.getState();
    const v = value.replace(/\s+$/, '');
    if (!v) {
      st.commit((pages) => updatePage(pages, pageId, (p) => ({ ...p, texts: p.texts.filter((x) => x.id !== t.id) })));
    } else if (v !== t.text) {
      st.commit((pages) => updateText(pages, pageId, t.id, (x) => ({ ...x, text: v })));
    }
    st.set({ editing: null });
  };

  return (
    <textarea
      ref={ref}
      className="text-editor"
      style={{ ...style, width: m.w + t.fontSize * 1.5, height: m.h + 4 }}
      value={value}
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onBlur={done}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) ref.current?.blur();
      }}
    />
  );
}

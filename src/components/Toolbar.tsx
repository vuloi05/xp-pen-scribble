import { useState } from 'react';
import type { Lang, Tool } from '../types';
import { useStore } from '../store';
import { Icon, type IconName } from './Icon';

const TOOLS: { id: Tool; icon: IconName; label: string; key: string }[] = [
  { id: 'scribble', icon: 'scribble', label: 'Viết → Chữ', key: 'S' },
  { id: 'pen', icon: 'pen', label: 'Bút mực', key: 'P' },
  { id: 'highlighter', icon: 'highlighter', label: 'Dạ quang', key: 'H' },
  { id: 'eraser', icon: 'eraser', label: 'Tẩy', key: 'E' },
  { id: 'select', icon: 'select', label: 'Chọn / Kéo', key: 'V' },
];

const LANGS: { id: Lang; label: string; key: string }[] = [
  { id: 'vi', label: 'VI', key: '1' },
  { id: 'en', label: 'EN', key: '2' },
  { id: 'ja', label: '日本', key: '3' },
];

const COLORS = ['#1f2a44', '#d62828', '#1d4ed8', '#15803d', '#7c3aed'];

interface Props {
  onOpen: () => void;
  onNewBlank: () => void;
  onAddPage: () => void;
  onExport: () => void;
  onCopyText: () => void;
  onZoom: (z: number | 'fit') => void;
  onHelp: () => void;
  busy: boolean;
}

export function Toolbar(p: Props) {
  const tool = useStore((s) => s.tool);
  const lang = useStore((s) => s.lang);
  const color = useStore((s) => s.color);
  const penSize = useStore((s) => s.penSize);
  const zoom = useStore((s) => s.zoom);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const settings = useStore((s) => s.settings);
  const set = useStore((s) => s.set);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <header className="toolbar">
      <div className="group">
        <span className="brand">✍️ InkPad</span>
        <button className="btn" onClick={p.onOpen} title="Mở file PDF (Ctrl+O)">
          <Icon name="open" /> <span>Mở PDF</span>
        </button>
        <button className="btn icon" onClick={p.onNewBlank} title="Tài liệu trắng mới">
          <Icon name="blank" />
        </button>
        <button className="btn icon" onClick={p.onAddPage} title="Thêm trang trắng">
          <Icon name="addPage" />
        </button>
      </div>

      <div className="group tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`btn tool${tool === t.id ? ' active' : ''}${t.id === 'scribble' ? ' scribble' : ''}`}
            onClick={() => set({ tool: t.id })}
            title={`${t.label} (${t.key})`}
          >
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="group">
        <div className="segmented" title="Ngôn ngữ nhận diện (1 / 2 / 3, L để đổi vòng)">
          {LANGS.map((l) => (
            <button key={l.id} className={lang === l.id ? 'active' : ''} onClick={() => set({ lang: l.id })}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => set({ color: c })}
              title="Màu mực"
            />
          ))}
        </div>
        <input
          className="size"
          type="range"
          min={0.8}
          max={8}
          step={0.2}
          value={penSize}
          onChange={(e) => set({ penSize: +e.target.value })}
          title={`Độ dày nét: ${penSize}`}
        />
      </div>

      <div className="group">
        <button className="btn icon" disabled={!canUndo} onClick={undo} title="Hoàn tác (Ctrl+Z)">
          <Icon name="undo" />
        </button>
        <button className="btn icon" disabled={!canRedo} onClick={redo} title="Làm lại (Ctrl+Y)">
          <Icon name="redo" />
        </button>
        <button className="btn icon" onClick={() => p.onZoom(zoom / 1.15)} title="Thu nhỏ (-)">
          <Icon name="zoomOut" />
        </button>
        <button className="btn zoom" onClick={() => p.onZoom('fit')} title="Vừa khung (0)">
          {Math.round(zoom * 100)}%
        </button>
        <button className="btn icon" onClick={() => p.onZoom(zoom * 1.15)} title="Phóng to (+)">
          <Icon name="zoomIn" />
        </button>
      </div>

      <div className="group right">
        <button className="btn icon" onClick={p.onCopyText} title="Sao chép toàn bộ chữ đã chuyển">
          <Icon name="copy" />
        </button>
        <button className="btn primary" onClick={p.onExport} disabled={p.busy} title="Xuất PDF (Ctrl+S)">
          <Icon name="download" /> <span>{p.busy ? 'Đang xuất…' : 'Xuất PDF'}</span>
        </button>
        <div className="popover-anchor">
          <button className={`btn icon${showSettings ? ' active' : ''}`} onClick={() => setShowSettings((v) => !v)} title="Cài đặt">
            <Icon name="settings" />
          </button>
          {showSettings && (
            <div className="popover">
              <label>
                Chờ sau khi nhấc bút: <b>{(settings.scribbleDelay / 1000).toFixed(1)}s</b>
                <input
                  type="range"
                  min={300}
                  max={2000}
                  step={100}
                  value={settings.scribbleDelay}
                  onChange={(e) => set({ settings: { ...settings, scribbleDelay: +e.target.value } })}
                />
              </label>
              <label className="row">
                <input type="checkbox" checked={settings.ruled} onChange={(e) => set({ settings: { ...settings, ruled: e.target.checked } })} />
                Dòng kẻ trên trang trắng
              </label>
            </div>
          )}
        </div>
        <button className="btn icon" onClick={p.onHelp} title="Hướng dẫn">
          <Icon name="help" />
        </button>
      </div>
    </header>
  );
}

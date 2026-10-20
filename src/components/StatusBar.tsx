import { useStore } from '../store';
import { LANG_LABEL } from '../lib/recognizer';

const TOOL_HINT: Record<string, string> = {
  scribble: 'Viết bằng bút → nhấc bút là tự chuyển thành chữ. Viết ngay sau dòng chữ để nối tiếp · Gạch zig-zag lên chữ để xoá',
  pen: 'Bút mực: ký tên, vẽ, ghi chú giữ nguyên nét tay',
  highlighter: 'Bút dạ quang: tô nổi bật nội dung PDF',
  eraser: 'Tẩy: quẹt qua nét mực hoặc chữ để xoá',
  select: 'Chọn: chạm chữ để chọn/kéo · nhấp đúp để sửa · kéo nền để cuộn · nhấp đúp chỗ trống để gõ chữ',
};

export function StatusBar() {
  const penInfo = useStore((s) => s.penInfo);
  const tool = useStore((s) => s.tool);
  const lang = useStore((s) => s.lang);
  const busy = useStore((s) => s.recognizing.length > 0);
  const waiting = useStore((s) => !!s.pending);
  const noPressure = penInfo.type === 'mouse' || (penInfo.type === 'pen' && penInfo.pressure === 0 && penInfo.buttons !== 0);

  return (
    <footer className="statusbar">
      <span className={`dot ${busy ? 'busy' : waiting ? 'wait' : 'idle'}`} />
      <span className="hint">{busy ? 'Đang chuyển chữ…' : waiting ? 'Đang chờ bạn viết tiếp…' : TOOL_HINT[tool]}</span>
      <span className="spacer" />
      <span className="badge">{LANG_LABEL[lang]}</span>
      <span className={`badge ${penInfo.type === 'pen' ? 'ok' : ''}`} title="Thiết bị nhập & lực nhấn hiện tại">
        {penInfo.type === 'pen' ? '🖊 Bút' : penInfo.type === 'mouse' ? '🖱 Chuột' : penInfo.type === 'touch' ? '☝ Chạm' : '—'}
        {penInfo.type === 'pen' && <> · lực {Math.round(penInfo.pressure * 100)}%</>}
      </span>
      {noPressure && penInfo.type === 'mouse' && (
        <span className="badge warn" title="Mở XP-Pen PenTablet → Pen → bật 'Windows Ink'">
          Chưa nhận lực nhấn? Bật “Windows Ink” trong driver XP-Pen
        </span>
      )}
    </footer>
  );
}

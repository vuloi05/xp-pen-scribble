export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="modal" onPointerDown={(e) => e.stopPropagation()}>
        <h2>Chào mừng đến InkPad ✍️</h2>
        <p className="muted">Viết tay bằng XP-Pen Deco 640 → tự động thành chữ gõ máy (Tiếng Việt · English · 日本語), giống Scribble trên iPad.</p>

        <h3>Cách dùng nhanh</h3>
        <ul>
          <li><b>Viết → Chữ (S)</b>: viết một từ/cụm từ, nhấc bút ~0.7s → nét mực biến thành chữ ngay tại chỗ.</li>
          <li>Viết <b>ngay bên phải</b> dòng chữ vừa chuyển → chữ mới được <b>nối tiếp</b> vào dòng đó.</li>
          <li><b>Gạch zig-zag</b> lên chữ → xoá chữ đó.</li>
          <li>Nhận sai? Chạm vào <b>phương án gợi ý</b> hiện ngay dưới chữ, hoặc <b>↶ Nét tay</b> để trả lại nét viết.</li>
          <li>Đổi ngôn ngữ: phím <kbd>1</kbd> VI · <kbd>2</kbd> EN · <kbd>3</kbd> 日本 · <kbd>L</kbd> đổi vòng.</li>
          <li>Công cụ: <kbd>P</kbd> bút mực · <kbd>H</kbd> dạ quang · <kbd>E</kbd> tẩy · <kbd>V</kbd> chọn · <kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> · <kbd>Ctrl+S</kbd> xuất PDF.</li>
          <li>Giữ <b>nút bên thân bút</b> khi viết → tẩy tạm thời.</li>
        </ul>

        <h3>Cài đặt XP-Pen Deco 640 (quan trọng)</h3>
        <ol>
          <li>Mở <b>XP-Pen PenTablet</b> → tab <b>Pen</b> → bật <b>Windows Ink</b> (để trình duyệt nhận lực nhấn 8192 mức).</li>
          <li>Tab <b>Work Area</b>: vì Deco 640 nhỏ (6.5×4"), nên map vùng bảng vẽ vào <b>một phần màn hình</b> hoặc phóng to trang (<kbd>+</kbd>) để viết chữ dễ hơn.</li>
          <li>Windows Settings → Bluetooth & devices → Pen & Windows Ink: tắt <b>“Press and hold to right-click”</b> để không bị khựng khi chấm dấu.</li>
          <li>Gán 8 phím ExpressKey theo phím tắt: S, P, E, V, 1, 2, 3, Ctrl+Z.</li>
        </ol>
        <p className="muted small">Nhận diện chữ dựa trên quỹ đạo nét bút (như bàn phím viết tay), không dùng AI tạo sinh. Cần kết nối Internet.</p>
        <button className="btn primary" onClick={onClose}>Bắt đầu viết</button>
      </div>
    </div>
  );
}

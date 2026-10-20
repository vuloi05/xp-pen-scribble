# InkPad Scribble ✍️

Ứng dụng ghi chú và viết đè PDF mô phỏng tính năng **Scribble trên iPad**, tối ưu đặc biệt cho bảng vẽ **XP-Pen Deco 640** (hỗ trợ cảm ứng lực 8192 mức, không độ trễ).

---

## 🚀 Cách mở và sử dụng ngay

- **Cách 1 (Khuyên dùng hàng ngày):** Nhấp đúp trực tiếp vào biểu tượng **InkPad Scribble** ngoài **Màn hình chính (Desktop)** hoặc tìm **InkPad Scribble** trong **Start Menu** (file chạy gốc là [`InkPad.exe`](file:///c:/Users/loivt/Downloads/write/InkPad.exe)). Ứng dụng sẽ mở thành một cửa sổ Desktop độc lập mà không cần chạy bất kỳ câu lệnh nào.
- **Cách 2 (Dành cho chỉnh sửa code):** Chạy `npm run dev` để mở tại `http://localhost:5173`, sau khi sửa code chạy `npm run build` để cập nhật cho `InkPad.exe`.

---

## ✨ Các tính năng đã hoàn thiện

1. **Viết → Chữ tự động (Scribble như iPad - Phím `S`)**:
   - Đặt bút XP-Pen viết từ/câu, nhấc bút khoảng `0.7s` nét mực tự biến thành chữ gõ máy ngay tại vị trí vừa viết.
   - **Hỗ trợ 3 ngôn ngữ**: **Tiếng Việt** (phím `1`), **English** (phím `2`), **日本語** (Kanji/Kana - phím `3`), hoặc phím `L` để đổi vòng.
   - **Viết nối dòng**: Viết tiếp ngay bên phải dòng chữ đã chuyển, chữ mới sẽ tự ghép tiếp vào dòng đó.
   - **Gạch xoá (Scratch-out)**: Quẹt zig-zag qua lại lên dòng chữ để xoá nhanh như iPad.
   - **Thanh sửa nhanh**: Chạm vào chữ để đổi các từ gợi ý khác, phóng to/thu nhỏ cỡ chữ, sửa bàn phím hoặc bấm `↶ Nét tay` để trả lại nét vẽ gốc.

2. **Ghi chú đè lên PDF**:
   - Bấm **Mở PDF** hoặc kéo thả file `.pdf` vào cửa sổ.
   - Hỗ trợ cuộn nhiều trang, phóng to thu nhỏ mượt mà.

3. **Bút vẽ tay chuyên dụng**:
   - **Bút mực (Phím `P`)**: Viết tay, ký tên, vẽ sơ đồ giữ nguyên nét với lực nhấn thanh đậm tự nhiên từ XP-Pen (`perfect-freehand`).
   - **Dạ quang (Phím `H`)**: Tô sáng văn bản trong PDF (chế độ hòa trộn multiply không che khuất chữ in).
   - **Tẩy (Phím `E`)**: Xóa nét vẽ hoặc chữ khi quẹt qua. Nhấn nút bên hông bút XP-Pen để tẩy nhanh tức thì.
   - **Chọn / Kéo (Phím `V`)**: Chạm để di chuyển chữ gõ máy, nhấp đúp vào chỗ trống để gõ chữ bằng bàn phím.

4. **Xuất PDF chuẩn Unicode**:
   - Bấm **Xuất PDF** (`Ctrl+S`): Giữ nguyên file PDF gốc, nhúng toàn bộ chữ gõ máy (font Unicode M PLUS 1p hỗ trợ đầy đủ Tiếng Việt và Kanji Nhật) và các nét vẽ tay vector sắc nét.
   - Bấm biểu tượng **Copy** để sao chép toàn bộ văn bản đã nhận diện sang clipboard.

---

## ⚙️ Cấu hình tối ưu cho bảng vẽ XP-Pen Deco 640

1. **Bật Windows Ink**:
   - Mở ứng dụng **XP-Pen PenTablet** trên máy tính → chọn tab **Pen** → tích chọn **Windows Ink**. Việc này cho phép trình duyệt nhận đầy đủ 8192 mức lực nhấn và tần số quét cao của bút.
2. **Tắt độ trễ giữ chuột phải của Windows**:
   - Vào **Windows Settings** → **Bluetooth & devices** → **Pen & Windows Ink** → tắt tùy chọn *"Press and hold to right-click"*. Điều này giúp việc chấm dấu tiếng Việt và viết nét ngắn không bị khựng lại.
3. **Gán phím tắt nhanh cho 8 nút ExpressKey trên XP-Pen Deco 640**:
   - K1: `S` (Bút viết thành chữ Scribble)
   - K2: `P` (Bút mực vẽ tự do)
   - K3: `E` (Tẩy)
   - K4: `V` (Chọn & Di chuyển)
   - K5: `Ctrl+Z` (Hoàn tác)
   - K6: `Ctrl+Y` (Làm lại)
   - K7: `L` (Đổi nhanh ngôn ngữ Việt / Anh / Nhật)
   - K8: `Ctrl+S` (Xuất PDF)

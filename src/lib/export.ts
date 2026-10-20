import { BlendMode, PDFDocument, degrees, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Page } from '../types';
import type { PdfDoc } from './pdf';
import { FONT_URL, LINE_HEIGHT, outlineToPath, strokeOutline } from './ink';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Xuất PDF: giữ nguyên trang PDF gốc, vẽ nét mực dạng vector và chữ gõ máy dạng text thật
 * (chọn/copy/tìm kiếm được), nhúng font Unicode hỗ trợ Việt + Nhật + Anh.
 */
export async function exportPdf(pages: Page[], pdfBytes: Uint8Array | null, pdfDoc: PdfDoc | null): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const fontBytes = new Uint8Array(await (await fetch(FONT_URL)).arrayBuffer());
  const font = await out.embedFont(fontBytes, { subset: true });
  const fk = fontkit.create(fontBytes) as unknown as { ascent: number; descent: number; unitsPerEm: number };
  const asc = fk.ascent / fk.unitsPerEm;
  const desc = fk.descent / fk.unitsPerEm; // âm

  const src = pdfBytes ? await PDFDocument.load(pdfBytes, { ignoreEncryption: true }) : null;

  for (const page of pages) {
    let toPdf: (x: number, y: number) => [number, number];
    let pdfPage;
    if (page.pdfIndex !== null && src && pdfDoc) {
      const [copied] = await out.copyPages(src, [page.pdfIndex]);
      pdfPage = out.addPage(copied);
      const vp = (await pdfDoc.getPage(page.pdfIndex + 1)).getViewport({ scale: 1 });
      toPdf = (x, y) => vp.convertToPdfPoint(x, y) as [number, number];
    } else {
      pdfPage = out.addPage([page.width, page.height]);
      toPdf = (x, y) => [x, page.height - y];
    }

    // drawSvgPath lật trục Y (scale 1,-1) quanh gốc (x,y) → truyền -y để về đúng toạ độ PDF
    const map = (x: number, y: number): [number, number] => {
      const [px, py] = toPdf(x, y);
      return [px, -py];
    };

    for (const s of page.strokes) {
      const d = outlineToPath(strokeOutline(s), map);
      if (!d) continue;
      pdfPage.drawSvgPath(d, {
        x: 0,
        y: 0,
        color: hexToRgb(s.color),
        opacity: s.kind === 'highlighter' ? 0.4 : 1,
        blendMode: s.kind === 'highlighter' ? BlendMode.Multiply : BlendMode.Normal,
        borderWidth: 0,
      });
    }

    for (const t of page.texts) {
      const fs = t.fontSize;
      const lineH = fs * LINE_HEIGHT;
      const lines = t.text.split('\n');
      lines.forEach((line, i) => {
        if (!line) return;
        const baseY = t.y + i * lineH + (lineH - (asc - desc) * fs) / 2 + asc * fs;
        const [px, py] = toPdf(t.x, baseY);
        const [qx, qy] = toPdf(t.x + 10, baseY);
        const angle = (Math.atan2(qy - py, qx - px) * 180) / Math.PI;
        pdfPage.drawText(line, { x: px, y: py, size: fs, font, color: hexToRgb(t.color), rotate: degrees(angle) });
      });
    }
  }
  return out.save();
}

export function downloadBytes(bytes: Uint8Array, name: string, type = 'application/pdf') {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Gom toàn bộ chữ gõ máy theo thứ tự đọc (trên→dưới, trái→phải) */
export function collectText(pages: Page[]): string {
  return pages
    .map((p) =>
      [...p.texts]
        .sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.fontSize, b.fontSize) * 0.6 ? a.x - b.x : a.y - b.y))
        .map((t) => t.text)
        .join('\n'),
    )
    .filter(Boolean)
    .join('\n\n');
}

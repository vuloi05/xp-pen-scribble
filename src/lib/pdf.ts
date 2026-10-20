import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = PDFDocumentProxy;
export type { PageViewport };

export async function loadPdf(bytes: Uint8Array): Promise<PdfDoc> {
  // pdf.js chuyển (transfer) buffer sang worker → truyền bản sao để giữ bytes gốc cho lúc xuất file
  return pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  }).promise;
}

export function destroyPdf(doc: PdfDoc | null | undefined) {
  if (!doc) return;
  const d = doc as unknown as { loadingTask?: { destroy?: () => Promise<void> }; destroy?: () => Promise<void> };
  void (d.loadingTask?.destroy?.() ?? d.destroy?.())?.catch?.(() => {});
}

export async function getPageViewports(doc: PdfDoc): Promise<PageViewport[]> {
  const out: PageViewport[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    out.push(p.getViewport({ scale: 1 }));
  }
  return out;
}

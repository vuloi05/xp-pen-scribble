import type { Lang, Stroke } from '../types';
import { strokesRect } from './geometry';

/**
 * Nhận diện chữ viết tay theo QUỸ ĐẠO NÉT BÚT (online handwriting recognition)
 * – giống bàn phím viết tay của Android/iPad: gửi toạ độ (x, y, t) của từng nét,
 * không gửi ảnh, không dùng mô hình AI tạo sinh. Phản hồi ~100ms.
 */
const ENDPOINT = 'https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8';

export interface RecognizeResult {
  candidates: string[];
}

export async function recognizeInk(strokes: Stroke[], lang: Lang, preContext = '', signal?: AbortSignal): Promise<RecognizeResult> {
  if (!strokes.length) return { candidates: [] };
  const r = strokesRect(strokes);
  // Chuẩn hoá: chiều cao chữ ≈ 200 đơn vị để bộ nhận diện có đủ độ phân giải.
  const k = Math.min(20, Math.max(1, 200 / Math.max(r.h, 1)));
  const t0 = strokes[0].points[0]?.[3] ?? 0;
  const ink = strokes.map((s) => {
    const xs: number[] = [], ys: number[] = [], ts: number[] = [];
    for (const p of s.points) {
      xs.push(Math.round((p[0] - r.x) * k));
      ys.push(Math.round((p[1] - r.y) * k));
      ts.push(Math.max(0, Math.round(p[3] - t0)));
    }
    return [xs, ys, ts];
  });
  const body = {
    options: 'enable_pre_space',
    requests: [
      {
        writing_guide: {
          writing_area_width: Math.round(r.w * k) + 20,
          writing_area_height: Math.round(r.h * k) + 20,
        },
        pre_context: preContext.slice(-20),
        max_num_results: 8,
        max_completions: 0,
        ink,
        language: lang,
      },
    ],
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.[0] !== 'SUCCESS') throw new Error('Nhận diện thất bại');
  const raw: string[] = data?.[1]?.[0]?.[1] ?? [];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const c of raw) {
    const v = c.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      candidates.push(v);
    }
  }
  return { candidates };
}

export const LANG_LABEL: Record<Lang, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
};

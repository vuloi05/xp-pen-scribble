export type Lang = 'vi' | 'en' | 'ja';
export type Tool = 'scribble' | 'pen' | 'highlighter' | 'eraser' | 'select';

/** [x, y, pressure, t(ms)] – toạ độ theo đơn vị trang PDF (point, chưa zoom) */
export type Point = [number, number, number, number];

export interface Stroke {
  id: string;
  kind: 'pen' | 'highlighter';
  points: Point[];
  color: string;
  size: number;
  /** true nếu thiết bị không gửi lực nhấn thật (chuột / driver tắt Windows Ink) */
  simulatePressure: boolean;
}

export interface TextItem {
  id: string;
  /** góc trên-trái của khung chữ (đơn vị trang) */
  x: number;
  y: number;
  fontSize: number;
  text: string;
  color: string;
  lang: Lang;
  /** các phương án nhận diện khác để người dùng chọn lại */
  candidates: string[];
  /** nét mực gốc – cho phép "hoàn tác về chữ viết tay" */
  sourceStrokes?: Stroke[];
}

export interface Page {
  id: string;
  width: number;
  height: number;
  /** chỉ số trang trong file PDF gốc; null = trang giấy trắng */
  pdfIndex: number | null;
  strokes: Stroke[];
  texts: TextItem[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

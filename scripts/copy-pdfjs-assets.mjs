// Sao chép cmaps + standard_fonts của pdf.js vào public/ để hiển thị đúng PDF tiếng Nhật (CJK) khi offline.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist');
const dst = join(root, 'public', 'pdfjs');
if (!existsSync(src)) process.exit(0);
mkdirSync(dst, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts']) {
  if (existsSync(join(src, dir))) cpSync(join(src, dir), join(dst, dir), { recursive: true });
}
console.log('pdf.js assets copied to public/pdfjs');

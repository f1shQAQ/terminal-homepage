import { stripAnsi } from './ansi';

// 与 xterm.js 默认的 Unicode 6 宽度表一致：中日韩全角字符占 2 格
export function charWidth(ch: string): number {
  const cp = ch.codePointAt(0)!;
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

export const strWidth = (s: string) => Array.from(stripAnsi(s)).reduce((n, ch) => n + charWidth(ch), 0);

export const padEnd = (s: string, width: number) => s + ' '.repeat(Math.max(0, width - strWidth(s)));

// 像 ls 一样按列排版，先竖后横
export function formatColumns(items: string[], cols: number): string {
  if (!items.length) return '';
  const colWidth = Math.max(...items.map(strWidth)) + 2;
  const perRow = Math.max(1, Math.floor(cols / colWidth));
  const rows = Math.ceil(items.length / perRow);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < perRow; c++) {
      const i = c * rows + r;
      if (i >= items.length) break;
      const isLast = (c + 1) * rows + r >= items.length;
      line += isLast ? items[i] : padEnd(items[i], colWidth);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

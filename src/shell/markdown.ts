import { dim, paint } from './ansi';

function inline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) => `${label} ${paint('4;34', url)}`)
    .replace(/`([^`]+)`/g, (_, code: string) => paint('33', code))
    .replace(/\*\*([^*]+)\*\*/g, (_, strong: string) => paint('1', strong));
}

// 把 Markdown 转成带 ANSI 颜色的终端文本，只处理主页内容会用到的语法
export function renderMarkdown(md: string): string {
  let inCode = false;
  const lines: string[] = [];
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      lines.push(paint('32', '    ' + line));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    if (heading) {
      const color = heading[1].length === 1 ? '1;35' : heading[1].length === 2 ? '1;36' : '1';
      lines.push(paint(color, heading[2]));
    } else if (bullet) {
      lines.push(`${bullet[1]}  ${paint('36', '•')} ${inline(bullet[2])}`);
    } else if (quote) {
      lines.push(dim('│ ') + inline(quote[1]));
    } else if (/^-{3,}$/.test(line.trim())) {
      lines.push(dim('─'.repeat(32)));
    } else {
      lines.push(inline(line));
    }
  }
  return lines.join('\n');
}

// 把一行命令拆成管道的各段，每段是参数数组。支持单双引号、反斜杠转义和 |
export function parse(line: string): string[][] {
  const stages: string[][] = [[]];
  let current = '';
  let hasToken = false;
  let quote: '"' | "'" | null = null;
  const chars = Array.from(line);

  const flush = () => {
    if (hasToken) stages[stages.length - 1].push(current);
    current = '';
    hasToken = false;
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < chars.length) current += chars[++i];
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
    } else if (ch === '\\' && i + 1 < chars.length) {
      current += chars[++i];
      hasToken = true;
    } else if (/\s/.test(ch)) {
      flush();
    } else if (ch === '|') {
      flush();
      stages.push([]);
    } else {
      current += ch;
      hasToken = true;
    }
  }

  if (quote) throw new Error('引号没有闭合');
  flush();
  return stages;
}

import { lookup, listDir, normalize } from '../fs/vfs';
import type { Completion } from './readline';
import type { Shell } from './shell';

const byPrefix = (word: string) => (s: string) => s.startsWith(word);

export function complete(before: string, shell: Shell): Completion {
  // 当前词：从光标往回找到空白或 | 为止
  let start = before.length;
  while (start > 0 && !/[\s|]/.test(before[start - 1])) start--;
  const word = before.slice(start);
  const segment = before.slice(0, start).split('|').pop()!.trim();
  const tokens = segment ? segment.split(/\s+/) : [];

  // 第一个词：补命令名
  if (!tokens.length) {
    const names = [...shell.commands.values()]
      .filter((c) => !c.hidden)
      .map((c) => c.name)
      .filter(byPrefix(word))
      .sort();
    return { word, candidates: names, labels: names };
  }

  const command = shell.commands.get(tokens[0]);
  const custom = command?.complete?.(tokens.slice(1), shell);
  if (custom) {
    const hits = custom.filter(byPrefix(word)).sort();
    return { word, candidates: hits, labels: hits };
  }

  // 其余参数：补虚拟文件系统里的路径
  const slash = word.lastIndexOf('/');
  const dirPart = word.slice(0, slash + 1);
  const base = word.slice(slash + 1);
  const dir = lookup(normalize(dirPart || '.', shell.cwd));
  if (!dir || dir.type !== 'dir') return { word, candidates: [], labels: [] };

  const candidates: string[] = [];
  const labels: string[] = [];
  for (const node of listDir(dir, base.startsWith('.'))) {
    if (!node.name.startsWith(base)) continue;
    if (command?.dirsOnly && node.type !== 'dir') continue;
    const suffix = node.type === 'dir' ? '/' : '';
    candidates.push(dirPart + node.name + suffix);
    labels.push(node.name + suffix);
  }
  return { word, candidates, labels };
}

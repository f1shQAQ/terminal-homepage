import { normalize, lookup, type FsNode } from '../fs/vfs';
import { paint } from '../shell/ansi';
import type { Context } from '../shell/types';

// -la 这样的短参数拆成单个字母，-- 之后的都当普通参数
export function parseFlags(args: string[]) {
  const flags = new Set<string>();
  const rest: string[] = [];
  let ended = false;
  for (const arg of args) {
    if (!ended && arg === '--') ended = true;
    else if (!ended && arg.length > 1 && arg.startsWith('-')) for (const ch of arg.slice(1)) flags.add(ch);
    else rest.push(arg);
  }
  return { flags, rest };
}

/** 读取文件参数，没有文件时读管道输入。出错返回 null，错误已经输出 */
export function readInput(ctx: Context, files: string[], name: string): string | null {
  if (!files.length) {
    if (ctx.stdin !== null) return ctx.stdin.replace(/\n$/, '');
    ctx.err(`${name}: 缺少输入，给一个文件名或者用管道，例如 cat about.md | ${name}`);
    return null;
  }
  const parts: string[] = [];
  for (const file of files) {
    const node = lookup(normalize(file, ctx.shell.cwd));
    if (!node) ctx.err(`${name}: ${file}: 没有那个文件或目录`);
    else if (node.type === 'dir') ctx.err(`${name}: ${file}: 是一个目录`);
    else parts.push(node.content.replace(/\n$/, ''));
  }
  return parts.length ? parts.join('\n') : null;
}

export function nodeLabel(node: FsNode, abs: string, color: boolean): string {
  if (node.type === 'dir') return color ? paint('1;34', node.name + '/') : node.name;
  if (color && abs.startsWith('/bin/')) return paint('1;32', node.name);
  return node.name;
}

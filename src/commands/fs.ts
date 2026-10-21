import { HOME, displayPath, listDir, lookup, normalize, type DirNode, type FsNode } from '../fs/vfs';
import { paint, stripAnsi } from '../shell/ansi';
import { renderMarkdown } from '../shell/markdown';
import type { Command } from '../shell/types';
import { formatColumns } from '../shell/width';
import { nodeLabel, parseFlags, readInput } from './util';

const join = (dir: string, name: string) => (dir === '/' ? `/${name}` : `${dir}/${name}`);

function longLine(node: FsNode, abs: string): string {
  const exec = node.type === 'dir' || abs.startsWith('/bin/');
  const mode = (node.type === 'dir' ? 'd' : '-') + (exec ? 'rwxr-xr-x' : 'rw-r--r--');
  const size = node.type === 'dir' ? 4096 : new TextEncoder().encode(node.content).length;
  return `${mode}  guest guest ${String(size).padStart(6)}  ${nodeLabel(node, abs, true)}`;
}

const ls: Command = {
  name: 'ls',
  summary: '列出目录内容',
  usage: 'ls [-a] [-l] [路径...]',
  run(ctx) {
    const { flags, rest } = parseFlags(ctx.args);
    const targets = rest.length ? rest : ['.'];
    const blocks: string[] = [];
    for (const target of targets) {
      const abs = normalize(target, ctx.shell.cwd);
      const node = lookup(abs);
      if (!node) {
        ctx.err(`ls: 无法访问 '${target}': 没有那个文件或目录`);
        continue;
      }
      const entries: [FsNode, string][] =
        node.type === 'dir' ? listDir(node, flags.has('a')).map((n) => [n, join(abs, n.name)]) : [[node, abs]];
      let body: string;
      if (flags.has('l')) body = entries.map(([n, p]) => longLine(n, p)).join('\n');
      else if (ctx.tty) body = formatColumns(entries.map(([n, p]) => nodeLabel(n, p, true)), ctx.shell.term.cols);
      else body = entries.map(([n]) => n.name).join('\n');
      if (targets.length > 1) body = `${target}:\n${body}`;
      if (body) blocks.push(body);
    }
    if (blocks.length) ctx.out(blocks.join('\n\n'));
  },
};

let previousDir = HOME;

const cd: Command = {
  name: 'cd',
  summary: '切换目录',
  usage: 'cd [目录]    不带参数回到 ~，cd - 回到上一个目录',
  dirsOnly: true,
  run(ctx) {
    const arg = ctx.args[0] ?? '~';
    const abs = normalize(arg === '-' ? previousDir : arg, ctx.shell.cwd);
    const node = lookup(abs);
    if (!node) return ctx.err(`cd: 没有那个文件或目录: ${arg}`);
    if (node.type !== 'dir') return ctx.err(`cd: 不是目录: ${arg}`);
    previousDir = ctx.shell.cwd;
    ctx.shell.setCwd(abs);
    if (arg === '-') ctx.out(displayPath(abs));
  },
};

const pwd: Command = {
  name: 'pwd',
  summary: '显示当前目录',
  run: (ctx) => ctx.out(ctx.shell.cwd),
};

const cat: Command = {
  name: 'cat',
  summary: '查看文件内容（Markdown 会上色）',
  usage: 'cat <文件...>',
  run(ctx) {
    if (!ctx.args.length) {
      if (ctx.stdin !== null) return ctx.out(ctx.stdin);
      return ctx.err('cat: 缺少文件名，试试 cat about.md');
    }
    for (const file of ctx.args) {
      const node = lookup(normalize(file, ctx.shell.cwd));
      if (!node) ctx.err(`cat: ${file}: 没有那个文件或目录`);
      else if (node.type === 'dir') ctx.err(`cat: ${file}: 是一个目录`);
      else {
        const text = node.content.replace(/\n$/, '');
        ctx.out(ctx.tty && node.name.endsWith('.md') ? renderMarkdown(text) : text);
      }
    }
  },
};

const tree: Command = {
  name: 'tree',
  summary: '以树形显示目录',
  usage: 'tree [-a] [目录]',
  dirsOnly: true,
  run(ctx) {
    const { flags, rest } = parseFlags(ctx.args);
    const target = rest[0] ?? '.';
    const abs = normalize(target, ctx.shell.cwd);
    const root = lookup(abs);
    if (!root) return ctx.err(`tree: ${target}: 没有那个文件或目录`);
    if (root.type !== 'dir') return ctx.err(`tree: ${target}: 不是目录`);

    const lines = [paint('1;34', target)];
    let dirs = 0;
    let files = 0;
    const walk = (dir: DirNode, dirAbs: string, prefix: string) => {
      const items = listDir(dir, flags.has('a'));
      items.forEach((node, i) => {
        const last = i === items.length - 1;
        const abs = join(dirAbs, node.name);
        lines.push(prefix + (last ? '└── ' : '├── ') + nodeLabel(node, abs, ctx.tty));
        if (node.type === 'dir') {
          dirs++;
          walk(node, abs, prefix + (last ? '    ' : '│   '));
        } else files++;
      });
    };
    walk(root, abs, '');
    ctx.out(`${lines.join('\n')}\n\n${dirs} 个目录，${files} 个文件`);
  },
};

const head: Command = {
  name: 'head',
  summary: '显示前几行',
  usage: 'head [-n 行数] [文件]',
  run(ctx) {
    const args = [...ctx.args];
    let count = 10;
    if (args[0] === '-n') {
      count = Number(args[1]);
      args.splice(0, 2);
    } else if (/^-\d+$/.test(args[0] ?? '')) {
      count = Number(args.shift()!.slice(1));
    }
    if (!Number.isInteger(count) || count < 0) return ctx.err('head: 行数要是非负整数');
    const text = readInput(ctx, args, 'head');
    if (text !== null && count > 0) ctx.out(text.split('\n').slice(0, count).join('\n'));
  },
};

const grep: Command = {
  name: 'grep',
  summary: '按关键词或正则过滤行',
  usage: 'grep [-i] <模式> [文件...]',
  run(ctx) {
    const { flags, rest } = parseFlags(ctx.args);
    const [pattern, ...files] = rest;
    if (!pattern) return ctx.err(`用法：${grep.usage}`);
    const text = readInput(ctx, files, 'grep');
    if (text === null) return;

    const mode = flags.has('i') ? 'gi' : 'g';
    let re: RegExp;
    try {
      re = new RegExp(pattern, mode);
    } catch {
      re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), mode);
    }
    const hits = text.split('\n').filter((line) => {
      re.lastIndex = 0;
      return re.test(stripAnsi(line));
    });
    if (!hits.length) return;
    ctx.out(
      hits
        .map((line) => (ctx.tty ? stripAnsi(line).replace(re, (m) => (m ? paint('1;31', m) : m)) : line))
        .join('\n'),
    );
  },
};

const wc: Command = {
  name: 'wc',
  summary: '统计行数、词数、字符数',
  usage: 'wc [-l] [文件...]',
  run(ctx) {
    const { flags, rest } = parseFlags(ctx.args);
    const text = readInput(ctx, rest, 'wc');
    if (text === null) return;
    const lines = text ? text.split('\n').length : 0;
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = Array.from(text).length;
    ctx.out(flags.has('l') ? String(lines) : `${lines} ${words} ${chars}`);
  },
};

export const fsCommands = [ls, cd, pwd, cat, tree, head, grep, wc];

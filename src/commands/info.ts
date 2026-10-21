import { LOGO } from '../banner';
import { HOME, listDir, lookup } from '../fs/vfs';
import { dim, paint } from '../shell/ansi';
import type { Command } from '../shell/types';
import { padEnd, strWidth } from '../shell/width';

const SHORTCUTS: [string, string][] = [
  ['Tab', '补全命令和路径，有多个候选时按两次列出'],
  ['↑ / ↓', '上一条 / 下一条历史命令'],
  ['Ctrl+R', '反向搜索历史，再按一次找更早的'],
  ['Ctrl+A / E', '跳到行首 / 行尾'],
  ['Alt+B / F', '按单词左移 / 右移'],
  ['Ctrl+U / K', '删到行首 / 删到行尾'],
  ['Alt+Backspace', '删除前一个单词（Ctrl+W 会被浏览器拿去关标签页）'],
  ['Ctrl+Y', '粘贴刚才删掉的内容'],
  ['Alt+.', '插入上一条命令的最后一个参数'],
  ['Ctrl+L', '清屏'],
  ['Ctrl+C', '有选中文字时复制，否则放弃当前输入'],
];

const commandNames = (_args: string[], shell: { commands: Map<string, Command> }) =>
  [...shell.commands.values()].filter((c) => !c.hidden).map((c) => c.name);

const help: Command = {
  name: 'help',
  summary: '显示帮助',
  usage: 'help [命令]',
  complete: commandNames,
  run(ctx) {
    const name = ctx.args[0];
    if (name) {
      const command = ctx.shell.commands.get(name);
      if (!command) return ctx.err(`help: 没有 ${name} 这个命令`);
      return ctx.out(`${paint('1', command.name)} — ${command.summary}\n\n用法：${command.usage ?? command.name}`);
    }
    const commands = [...ctx.shell.commands.values()].filter((c) => !c.hidden).sort((a, b) => a.name.localeCompare(b.name));
    const width = Math.max(...commands.map((c) => c.name.length)) + 3;
    const keyWidth = Math.max(...SHORTCUTS.map(([k]) => strWidth(k))) + 3;
    ctx.out(
      [
        paint('1', '命令'),
        ...commands.map((c) => `  ${paint('32', c.name.padEnd(width))}${c.summary}`),
        '',
        paint('1', '快捷键'),
        ...SHORTCUTS.map(([k, d]) => `  ${paint('33', padEnd(k, keyWidth))}${d}`),
        '',
        dim('支持管道，例如 cat about.md | grep 技术'),
      ].join('\n'),
    );
  },
};

const man: Command = { ...help, name: 'man', hidden: true };

const whoami: Command = {
  name: 'whoami',
  summary: '你是谁',
  run: (ctx) => ctx.out(`guest\n${dim('想知道我是谁？试试 cat about.md')}`),
};

const projects: Command = {
  name: 'projects',
  summary: '列出我的项目',
  run(ctx) {
    const dir = lookup(`${HOME}/projects`);
    if (!dir || dir.type !== 'dir') return ctx.err('projects: 还没有项目');
    const rows = listDir(dir).flatMap((node) => {
      if (node.type !== 'file') return [];
      const lines = node.content.split('\n').map((l) => l.trim());
      const title = lines.find((l) => l.startsWith('# '))?.slice(2) ?? node.name;
      const desc = lines.find((l) => l && !l.startsWith('#')) ?? '';
      return [`${paint('1;36', title)}\n  ${desc}\n  ${dim(`cat projects/${node.name}`)}`];
    });
    ctx.out(rows.join('\n\n'));
  },
};

const open: Command = {
  name: 'open',
  summary: '在新标签页打开链接',
  usage: 'open <网址>',
  complete: () => [],
  run(ctx) {
    const target = ctx.args[0];
    if (!target) return ctx.err(`用法：${open.usage}`);
    const url = /^https?:\/\//.test(target) ? target : `https://${target}`;
    window.open(url, '_blank', 'noopener');
    ctx.out(`正在打开 ${url}`);
  },
};

function uptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m} 分 ${s % 60} 秒` : `${s} 秒`;
}

const neofetch: Command = {
  name: 'neofetch',
  summary: '显示系统信息',
  run(ctx) {
    const { shell } = ctx;
    const key = (k: string) => paint('1;36', k);
    const swatch = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `\x1b[4${i}m   `).join('') + '\x1b[0m';
    const info = [
      `${paint('1;32', 'guest')}@${paint('1;32', 'f1sh')}`,
      '──────────',
      `${key('OS')}: TermOS (浏览器)`,
      `${key('Shell')}: tsh 0.1`,
      `${key('Terminal')}: xterm.js`,
      `${key('Theme')}: ${shell.theme.resolved} (${shell.theme.mode})`,
      `${key('Resolution')}: ${innerWidth}x${innerHeight}`,
      `${key('Uptime')}: ${uptime(Date.now() - shell.startedAt)}`,
      `${key('Locale')}: ${navigator.language}`,
      '',
      swatch,
    ];
    const logoWidth = Math.max(...LOGO.map((l) => l.length)) + 3;
    if (shell.term.cols < logoWidth + 32) return ctx.out([...LOGO.map((l) => paint('36', l)), '', ...info].join('\n'));
    const rows = Math.max(LOGO.length, info.length);
    const lines: string[] = [];
    for (let i = 0; i < rows; i++) lines.push(paint('36', (LOGO[i] ?? '').padEnd(logoWidth)) + (info[i] ?? ''));
    ctx.out(lines.join('\n'));
  },
};

export const infoCommands = [help, man, whoami, projects, open, neofetch];

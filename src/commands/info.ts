import { padEnd, strWidth } from '../shell/width';
import { DEFAULT_LOGO, LOGOS, renderLogo } from './logos';
import { HOME, listDir, lookup } from '../fs/vfs';
import { dim, paint } from '../shell/ansi';
import type { Command } from '../shell/types';

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
      if (!command || command.hidden) return ctx.err(`help: 没有 ${name} 这个命令`);
      return ctx.out(`${paint('1', command.name)} — ${command.summary}\n用法：${command.usage ?? command.name}`);
    }
    const names = commandNames([], ctx.shell).sort();
    ctx.out(
      [
        '命令格式：<命令> [参数...]',
        `可用命令：${names.join(', ')}`,
        '',
        // hidden 的命令不列出来，留给访客自己发现
        paint('90', '这里还藏着一些彩蛋，试着把它们都找出来吧！'),
      ].join('\n'),
    );
  },
};

const man: Command = { ...help, name: 'man', hidden: true };

const whoami: Command = {
  name: 'whoami',
  summary: '你是谁',
  run: (ctx) => ctx.out(`guest\n${dim('想知道我是谁？试试 cat README.md')}`),
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

const BLOG_URL = 'https://blog.fishqaq.com';

const blog: Command = {
  name: 'blog',
  summary: '跳转到我的博客',
  complete: () => [],
  run(ctx) {
    ctx.out(`正在跳转到 ${BLOG_URL} ...`);
    // 等这行字显示出来再跳
    setTimeout(() => location.assign(BLOG_URL), 300);
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
      `${paint('1;32', 'guest')}@${paint('1;32', 'fishqaq.com')}`,
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
    // 和 fastfetch 用同一个默认 logo
    const logo = renderLogo(LOGOS[DEFAULT_LOGO]);
    const logoWidth = Math.max(...logo.map(strWidth)) + 3;
    if (shell.term.cols < logoWidth + 32) return ctx.out([...logo, '', ...info].join('\n'));
    const rows = Math.max(logo.length, info.length);
    const lines: string[] = [];
    for (let i = 0; i < rows; i++) lines.push(padEnd(logo[i] ?? '', logoWidth) + (info[i] ?? ''));
    ctx.out(lines.join('\n'));
  },
};

export const infoCommands = [help, man, whoami, projects, blog, open, neofetch];

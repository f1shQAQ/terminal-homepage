import { welcome } from '../banner';
import { dim } from '../shell/ansi';
import type { Command } from '../shell/types';
import type { ThemeMode } from '../theme';
import { parseFlags } from './util';

const MODES: ThemeMode[] = ['auto', 'dark', 'light'];

const clear: Command = {
  name: 'clear',
  summary: '清屏',
  run: (ctx) => ctx.shell.term.write('\x1b[H\x1b[2J\x1b[3J'),
};

const echo: Command = {
  name: 'echo',
  summary: '输出文字',
  usage: 'echo [文字...]',
  complete: () => [],
  run: (ctx) => ctx.out(ctx.args.join(' ')),
};

const date: Command = {
  name: 'date',
  summary: '显示当前时间',
  run: (ctx) => ctx.out(new Date().toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'medium' })),
};

const history: Command = {
  name: 'history',
  summary: '查看命令历史',
  usage: 'history [-c]    -c 清空历史',
  complete: () => ['-c'],
  run(ctx) {
    if (parseFlags(ctx.args).flags.has('c')) return ctx.shell.history.clear();
    const items = ctx.shell.history.all;
    const width = String(items.length).length;
    if (items.length) ctx.out(items.map((line, i) => `  ${String(i + 1).padStart(width)}  ${line}`).join('\n'));
  },
};

const theme: Command = {
  name: 'theme',
  summary: '切换深色 / 浅色主题',
  usage: 'theme [auto|dark|light]    auto 跟随系统',
  complete: () => MODES,
  run(ctx) {
    const t = ctx.shell.theme;
    const mode = ctx.args[0] as ThemeMode | undefined;
    if (!mode) return ctx.out(`当前：${t.resolved}（模式 ${t.mode}）\n用法：${theme.usage}`);
    if (!MODES.includes(mode)) return ctx.err(`theme: 不认识 ${mode}，可选 auto、dark、light`);
    t.set(mode);
    ctx.out(mode === 'auto' ? `已切换为跟随系统，现在是 ${t.resolved}` : `已切换为 ${mode}`);
  },
};

const uname: Command = {
  name: 'uname',
  summary: '显示系统名称',
  usage: 'uname [-a]',
  complete: () => ['-a'],
  run: (ctx) =>
    ctx.out(parseFlags(ctx.args).flags.has('a') ? `TermOS f1sh 0.1.0 xterm.js ${navigator.platform || 'web'}` : 'TermOS'),
};

const which: Command = {
  name: 'which',
  summary: '查找命令位置',
  usage: 'which <命令...>',
  complete: (_args, shell) => [...shell.commands.values()].filter((c) => !c.hidden).map((c) => c.name),
  run(ctx) {
    for (const name of ctx.args) {
      const command = ctx.shell.commands.get(name);
      if (command && !command.hidden) ctx.out(`/bin/${name}`);
      else ctx.err(`${name} not found`);
    }
  },
};

const motd: Command = {
  name: 'motd',
  summary: '再看一次欢迎信息',
  run: (ctx) => ctx.out(welcome()),
};

const exit: Command = {
  name: 'exit',
  summary: '退出',
  run: (ctx) => ctx.out(`logout\n${dim('这是网页，退不出去的 :)')}`),
};

const sudo: Command = {
  name: 'sudo',
  summary: '以管理员身份运行',
  hidden: true,
  run: (ctx) => ctx.err('guest 不在 sudoers 文件中。此事将被报告。'),
};

export const systemCommands = [clear, echo, date, history, theme, uname, which, motd, exit, sudo];

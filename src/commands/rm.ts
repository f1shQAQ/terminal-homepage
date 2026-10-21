import { welcome } from '../banner';
import { HOME, listDir, lookup, normalize, type FsNode } from '../fs/vfs';
import { dim, paint, red } from '../shell/ansi';
import type { Command, Context } from '../shell/types';
import { parseFlags } from './util';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 只用来打印，让"删除"看起来像在删整个系统；虚拟文件系统里没有这些文件
const FAKE_PATHS = [
  '/boot/vmlinuz-6.6.6-fish',
  '/boot/initramfs-6.6.6-fish.img',
  '/usr/bin/python3',
  '/usr/bin/vim',
  '/usr/lib/libc.so.6',
  '/usr/lib/systemd/systemd',
  '/var/log/syslog',
  '/etc/passwd',
  '/etc/fstab',
];

// 触发彩蛋的目标；单独的 / 要加 --no-preserve-root，和真的 GNU rm 一样
const DOOM_TARGETS = new Set(['/', '/*', '~', '~/', '~/*', '*']);

const CLEAR = '\x1b[H\x1b[2J\x1b[3J';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

function removalLines(): string[] {
  const lines = FAKE_PATHS.map((path) => `removed '${path}'`);
  const walk = (node: FsNode, path: string) => {
    if (node.type === 'file') {
      lines.push(`removed '${path}'`);
      return;
    }
    for (const child of listDir(node, true)) walk(child, path === '/' ? `/${child.name}` : `${path}/${child.name}`);
    if (path !== '/') lines.push(`removed directory '${path}'`);
  };
  walk(lookup('/')!, '/');
  return lines;
}

const uptime = () => (performance.now() / 1000).toFixed(6).padStart(12);

/** 假装把系统删光：逐行删除 → 内核崩溃 → 揭晓 → 重启回欢迎页 */
async function meltdown(ctx: Context) {
  const { shell } = ctx;
  const write = (text: string) => shell.term.write(text);

  write(HIDE_CURSOR);
  for (const line of removalLines()) {
    write(dim(line) + '\n');
    await sleep(35);
  }
  write(red("rm: 无法删除 '/proc/1/mem': 设备或资源忙") + '\n');
  await sleep(800);

  write(CLEAR);
  write(red(`[${uptime()}] Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000009`) + '\n');
  write(red(`[${uptime()}] ---[ end Kernel panic - not syncing: Attempted to kill init! ]---`) + '\n');
  await sleep(2500);

  write('\n……开玩笑的，这里什么都删不掉。正在重启……\n');
  await sleep(1500);

  write(CLEAR);
  for (const step of ['Mounted /home/guest', 'Started tsh.service', 'Reached target 咸鱼小窝']) {
    write(`[  ${paint('32', 'OK')}  ] ${step}.\n`);
    await sleep(300);
  }
  await sleep(500);

  write(CLEAR + welcome() + '\n' + SHOW_CURSOR);
  shell.setCwd(HOME);
}

export const rm: Command = {
  name: 'rm',
  summary: '删除文件',
  usage: 'rm [-rf] <文件...>',
  hidden: true,
  async run(ctx) {
    const noPreserveRoot = ctx.args.includes('--no-preserve-root');
    const args = ctx.args
      .filter((a) => a !== '--no-preserve-root')
      .map((a) => (a === '--recursive' ? '-r' : a === '--force' ? '-f' : a));
    const { flags, rest } = parseFlags(args);
    const recursive = flags.has('r') || flags.has('R');

    if (!rest.length) return ctx.err('rm: 缺少操作数');
    if (recursive && rest.includes('/') && !noPreserveRoot) {
      return ctx.err("rm: 在 '/' 进行递归操作十分危险\nrm: 使用 --no-preserve-root 选项跳过安全模式");
    }
    if (recursive && rest.some((t) => DOOM_TARGETS.has(t))) return meltdown(ctx);

    for (const target of rest) {
      const node = lookup(normalize(target, ctx.shell.cwd));
      if (!node) {
        if (!flags.has('f')) ctx.err(`rm: 无法删除 '${target}': 没有那个文件或目录`);
      } else if (node.type === 'dir' && !recursive) {
        ctx.err(`rm: 无法删除 '${target}': 是一个目录`);
      } else {
        ctx.err(`rm: 无法删除 '${target}': 只读文件系统`);
      }
    }
  },
};

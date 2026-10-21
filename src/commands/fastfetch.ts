import { paint } from '../shell/ansi';
import type { Command } from '../shell/types';
import { padEnd, strWidth } from '../shell/width';
import { DEFAULT_LOGO, LOGOS, renderLogo } from './logos';

function hostOs(ua: string): string {
  if (/Windows/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

function browser(ua: string): string {
  const rules: [RegExp, string][] = [
    [/Edg\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ];
  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return 'Unknown';
}

// fastfetch 的格式：1 hour, 2 mins / 5 mins / 30 secs
function uptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (h) return [plural(h, 'hour'), m && plural(m, 'min')].filter(Boolean).join(', ');
  if (m) return plural(m, 'min');
  return plural(s, 'sec');
}

const size = (bytes: number) => {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GiB` : `${mb.toFixed(2)} MiB`;
};

// 下面几个是非标准 API，只有部分浏览器有，没有就不显示那一行
interface ExtraNavigator {
  deviceMemory?: number;
  getBattery?: () => Promise<{ level: number; charging: boolean }>;
}
interface ExtraPerformance {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
}

async function memoryLine(): Promise<string | null> {
  const heap = (performance as Performance & ExtraPerformance).memory;
  if (heap) {
    const pct = Math.round((heap.usedJSHeapSize / heap.jsHeapSizeLimit) * 100);
    return `${size(heap.usedJSHeapSize)} / ${size(heap.jsHeapSizeLimit)} (${pct}%)`;
  }
  const device = (navigator as Navigator & ExtraNavigator).deviceMemory;
  return device ? `${device} GiB` : null;
}

async function batteryLine(): Promise<string | null> {
  const getBattery = (navigator as Navigator & ExtraNavigator).getBattery;
  if (!getBattery) return null;
  try {
    const battery = await getBattery.call(navigator);
    return `${Math.round(battery.level * 100)}%${battery.charging ? ' [AC Connected]' : ' [Discharging]'}`;
  } catch {
    return null;
  }
}

export const fastfetch: Command = {
  name: 'fastfetch',
  summary: '显示系统信息',
  usage: 'fastfetch [-l <logo>] [--list-logos]',
  complete: (args) => {
    const prev = args[args.length - 1];
    return prev === '-l' || prev === '--logo' ? Object.keys(LOGOS) : ['-l', '--logo', '--list-logos'];
  },
  async run(ctx) {
    const { shell } = ctx;

    if (ctx.args.includes('--list-logos')) {
      const width = Math.max(...Object.keys(LOGOS).map((n) => n.length)) + 3;
      return ctx.out(
        Object.entries(LOGOS)
          .map(([name, logo]) => `${paint('1;36', name.padEnd(width))}${logo.description}`)
          .join('\n'),
      );
    }
    const flag = ctx.args.findIndex((a) => a === '-l' || a === '--logo');
    const logoName = flag >= 0 ? ctx.args[flag + 1] : DEFAULT_LOGO;
    const logoSpec = logoName ? LOGOS[logoName] : undefined;
    if (!logoSpec) return ctx.err(`fastfetch: 没有 ${logoName ?? ''} 这个 logo，用 fastfetch --list-logos 查看`);

    const ua = navigator.userAgent;
    const theme = shell.theme.resolved === 'dark' ? 'Catppuccin Mocha [Dark]' : 'Catppuccin Latte [Light]';
    const packages = [...shell.commands.values()].filter((c) => !c.hidden).length;

    const fields: [string, string | null][] = [
      ['OS', `TermOS 0.1 (${hostOs(ua)})`],
      ['Host', browser(ua)],
      ['Kernel', 'xterm.js'],
      ['Uptime', uptime(Date.now() - shell.startedAt)],
      ['Packages', `${packages} (bin)`],
      ['Shell', 'tsh 0.1'],
      ['Display', `${screen.width}x${screen.height} @ ${devicePixelRatio}x`],
      ['Theme', shell.theme.mode === 'auto' ? `${theme} (auto)` : theme],
      ['Terminal', `xterm.js (${shell.term.cols}x${shell.term.rows})`],
      ['CPU', `${navigator.hardwareConcurrency || '?'} threads`],
      ['Memory', await memoryLine()],
      ['Battery', await batteryLine()],
      ['Locale', navigator.language],
    ];

    const title = `${paint('1;36', 'guest')}@${paint('1;36', 'fishqaq.com')}`;
    // 用背景色画色块，█ 字符在部分字体下会有缝
    const blocks = (base: number) =>
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `\x1b[${base + i}m   `).join('') + '\x1b[0m';
    const info = [
      title,
      '-'.repeat(strWidth(title)),
      ...fields.filter(([, v]) => v !== null).map(([k, v]) => `${paint('1;36', k)}: ${v}`),
      '',
      blocks(40),
      blocks(100),
    ];

    // 终端太窄就上下排，否则 logo 在左、信息在右
    const logo = renderLogo(logoSpec);
    const logoWidth = Math.max(...logo.map(strWidth)) + 3;
    const infoWidth = Math.max(...info.map(strWidth));
    if (shell.term.cols < logoWidth + infoWidth) return ctx.out([...logo, '', ...info].join('\n'));
    const rows = Math.max(logo.length, info.length);
    const lines: string[] = [];
    for (let i = 0; i < rows; i++) lines.push(padEnd(logo[i] ?? '', logoWidth) + (info[i] ?? ''));
    ctx.out(lines.join('\n'));
  },
};

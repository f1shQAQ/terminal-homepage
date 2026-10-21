import { paint } from '../shell/ansi';

export interface Logo {
  description: string;
  lines: string[];
  /** 从上到下依次使用的 ANSI 颜色，按行数平均分配 */
  colors: string[];
}

// 文字 logo 用 figlet 生成（字体见 description），其余是手画的
export const LOGOS: Record<string, Logo> = {
  fish: {
    description: '一条吐泡泡的鱼',
    colors: ['1;36'],
    lines: [
      '.',
      "  O   _..--''''--.._",
      "o  .-'   o          '-.   /|",
      '  <   )))              >-< |',
      "   '-.              .-'   \\|",
      "      ''--......--''",
    ],
  },
  cat: {
    description: '一只猫',
    colors: ['1;33'],
    lines: [
      '    /\\_____/\\',
      '   /  o   o  \\',
      '  ( ==  ^  == )',
      '   )         (',
      '  (           )',
      ' ( (  )   (  ) )',
      '(__(__)___(__)__)',
    ],
  },
  shadow: {
    description: 'FISH / QAQ 两行大字（figlet ANSI Shadow，方块字符）',
    // 上半 FISH 青色，下半 QAQ 蓝色
    colors: ['1;36', '1;34'],
    lines: [
      '███████╗██╗███████╗██╗  ██╗',
      '██╔════╝██║██╔════╝██║  ██║',
      '█████╗  ██║███████╗███████║',
      '██╔══╝  ██║╚════██║██╔══██║',
      '██║     ██║███████║██║  ██║',
      '╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝',
      ' ██████╗  █████╗  ██████╗',
      '██╔═══██╗██╔══██╗██╔═══██╗',
      '██║   ██║███████║██║   ██║',
      '██║▄▄ ██║██╔══██║██║▄▄ ██║',
      '╚██████╔╝██║  ██║╚██████╔╝',
      ' ╚══▀▀═╝ ╚═╝  ╚═╝ ╚══▀▀═╝',
    ],
  },
  slant: {
    description: 'fishqaq 斜体字（figlet Slant）',
    colors: ['1;36', '1;34'],
    lines: [
      '    _____      __',
      '   / __(_)____/ /_  ____ _____ _____ _',
      '  / /_/ / ___/ __ \\/ __ `/ __ `/ __ `/',
      ' / __/ (__  ) / / / /_/ / /_/ / /_/ /',
      '/_/ /_/____/_/ /_/\\__, /\\__,_/\\__, /',
      '                    /_/         /_/',
    ],
  },
  small: {
    description: 'fishqaq 小字（figlet Small）',
    colors: ['1;36', '1;34'],
    lines: [
      '   __ _    _',
      '  / _(_)__| |_  __ _ __ _ __ _',
      " |  _| (_-< ' \\/ _` / _` / _` |",
      ' |_| |_/__/_||_\\__, \\__,_\\__, |',
      '                  |_|       |_|',
    ],
  },
};

export const DEFAULT_LOGO = 'shadow';

/** 给每一行上色 */
export function renderLogo(logo: Logo): string[] {
  return logo.lines.map((line, i) => paint(logo.colors[Math.floor((i * logo.colors.length) / logo.lines.length)], line));
}

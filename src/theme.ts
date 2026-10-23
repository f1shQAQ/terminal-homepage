import type { ITheme, Terminal } from '@xterm/xterm';

export type ThemeMode = 'auto' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'term:theme';
const query = matchMedia('(prefers-color-scheme: dark)');

// Catppuccin Mocha / Latte
export const palettes: Record<ResolvedTheme, ITheme> = {
  dark: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    cursorAccent: '#1e1e2e',
    selectionBackground: '#585b7099',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
  },
  light: {
    background: '#eff1f5',
    foreground: '#4c4f69',
    cursor: '#dc8a78',
    cursorAccent: '#eff1f5',
    selectionBackground: '#acb0be99',
    black: '#5c5f77',
    red: '#d20f39',
    green: '#40a02b',
    yellow: '#df8e1d',
    blue: '#1e66f5',
    magenta: '#ea76cb',
    cyan: '#179299',
    white: '#acb0be',
    brightBlack: '#6c6f85',
    brightRed: '#d20f39',
    brightGreen: '#40a02b',
    brightYellow: '#df8e1d',
    brightBlue: '#1e66f5',
    brightMagenta: '#ea76cb',
    brightCyan: '#179299',
    brightWhite: '#bcc0cc',
  },
};

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // 隐私模式等情况下读不到，按 auto 处理
  }
  return 'auto';
}

export class ThemeController {
  mode: ThemeMode = readMode();

  constructor(private term: Terminal) {
    // 系统切换深浅色时，auto 模式实时跟随
    query.addEventListener('change', () => {
      if (this.mode === 'auto') this.apply();
    });
    this.apply();
  }

  get resolved(): ResolvedTheme {
    if (this.mode !== 'auto') return this.mode;
    return query.matches ? 'dark' : 'light';
  }

  set(mode: ThemeMode) {
    this.mode = mode;
    try {
      if (mode === 'auto') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // 存不下也不影响本次切换
    }
    this.apply();
  }

  private apply() {
    const theme = this.resolved;
    document.documentElement.dataset.theme = theme;
    this.term.options.theme = palettes[theme];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palettes[theme].background!);
  }
}

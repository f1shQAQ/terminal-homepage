import '@xterm/xterm/css/xterm.css';
import './style.css';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { welcome } from './banner';
import { fsCommands } from './commands/fs';
import { infoCommands } from './commands/info';
import { systemCommands } from './commands/system';
import { displayPath } from './fs/vfs';
import { Shell } from './shell/shell';
import { ThemeController } from './theme';

const container = document.getElementById('terminal')!;
const title = document.getElementById('title')!;

const term = new Terminal({
  fontFamily: '"JetBrains Mono", "Cascadia Mono", "Cascadia Code", "SF Mono", Menlo, Consolas, "Microsoft YaHei UI", monospace',
  fontSize: innerWidth < 640 ? 13 : 15,
  lineHeight: 1.2,
  cursorBlink: true,
  convertEol: true,
  scrollback: 2000,
  macOptionIsMeta: true,
});

// 主题要在 open 之前设好，否则 viewport 会先用默认的黑色背景
const theme = new ThemeController(term);

const fit = new FitAddon();
term.loadAddon(fit);
term.loadAddon(new WebLinksAddon((_event, uri) => window.open(uri, '_blank', 'noopener')));
term.open(container);
fit.fit();
new ResizeObserver(() => fit.fit()).observe(container);

term.attachCustomKeyEventHandler((e) => {
  if (e.type !== 'keydown') return true;
  const key = e.key.toLowerCase();
  // 有选中文字时 Ctrl+C 是复制，不是中断
  if (e.ctrlKey && !e.shiftKey && key === 'c' && term.hasSelection()) {
    navigator.clipboard?.writeText(term.getSelection()).catch(() => {});
    term.clearSelection();
    return false;
  }
  // Ctrl+V / Cmd+V 交给浏览器走正常粘贴
  if ((e.ctrlKey || e.metaKey) && key === 'v') return false;
  // macOS 的 Cmd 组合键（复制、刷新等）交给浏览器
  if (e.metaKey) return false;
  return true;
});

const shell = new Shell(term, theme);
shell.register([...fsCommands, ...infoCommands, ...systemCommands]);
shell.onCwdChange = (cwd) => {
  const text = `guest@fishqaq.com: ${displayPath(cwd)}`;
  title.textContent = text;
  document.title = text;
};

// 手机上的快捷键栏
const sequences: Record<string, string> = {
  tab: '\t',
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  'ctrl-c': '\x03',
  'ctrl-r': '\x12',
  'ctrl-l': '\x0c',
};
document.querySelectorAll<HTMLButtonElement>('#keys button').forEach((button) => {
  // 阻止按钮抢走焦点，否则软键盘会收起来
  button.addEventListener('pointerdown', (e) => e.preventDefault());
  button.addEventListener('click', () => {
    shell.readline.handle(sequences[button.dataset.key!]);
    term.focus();
  });
});

// 开发时方便在控制台里调试
if (import.meta.env.DEV) Object.assign(window, { term, shell });

term.write(welcome() + '\n');
term.focus();
shell.run();

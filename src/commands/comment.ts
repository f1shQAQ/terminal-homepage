import type { Command } from '../shell/types';
import type { ResolvedTheme } from '../theme';

// 留言存在 f1shQAQ/blog-community 的 Discussions 里，所有留言都进同一个讨论帖
const GISCUS = {
  repo: 'f1shQAQ/blog-community',
  repoId: 'R_kgDOVTGZAg',
  category: 'Home-Page',
  categoryId: 'DIC_kwDOVTGZAs4DJT8D',
  mapping: 'specific',
  term: 'guestbook',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'top',
  lang: 'zh-CN',
};

const ORIGIN = 'https://giscus.app';
const giscusTheme = (theme: ResolvedTheme) => (theme === 'dark' ? 'catppuccin_mocha' : 'catppuccin_latte');

const overlay = document.getElementById('comment')!;
const body = overlay.querySelector<HTMLElement>('.comment-body')!;
let loaded = false;
let onClose: (() => void) | null = null;

/** giscus 的脚本只在第一次打开时加载，之后关掉只是隐藏，再打开不用重新加载 */
function load() {
  if (loaded) return;
  loaded = true;
  const script = document.createElement('script');
  script.src = `${ORIGIN}/client.js`;
  script.async = true;
  script.crossOrigin = 'anonymous';
  Object.assign(script.dataset, GISCUS, { theme: giscusTheme(document.documentElement.dataset.theme as ResolvedTheme) });
  body.after(script);
}

/** 跟着 theme 命令切换 giscus 的配色；iframe 还没加载好时发了也没事，加载时用的就是当前主题 */
export function setCommentTheme(theme: ResolvedTheme) {
  const frame = overlay.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
  frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme: giscusTheme(theme) } } }, ORIGIN);
}

function close() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  onClose?.();
  onClose = null;
}

overlay.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
// 点窗口外面的遮罩也关掉
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) close();
});
// 焦点在 iframe 里时按键传不到这里，只能点按钮关
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') close();
});

/** 打开留言板，关掉时 resolve */
export function openComment(): Promise<void> {
  load();
  overlay.hidden = false;
  overlay.querySelector<HTMLElement>('.comment-window')!.focus();
  return new Promise((resolve) => (onClose = resolve));
}

/** GitHub 登录完会带着 ?giscus= 跳回首页，这时要自动打开，giscus 的脚本也要靠这个参数拿到登录状态 */
export const returningFromLogin = () => new URLSearchParams(location.search).has('giscus');

export const comment: Command = {
  name: 'comment',
  summary: '打开留言板',
  complete: () => [],
  async run(ctx) {
    const { term } = ctx.shell;
    // 像真的程序一样占住终端，关掉窗口才回到提示符
    term.write('正在打开留言板 ...\n');
    term.blur();
    await openComment();
    term.focus();
  },
};

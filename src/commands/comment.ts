import type { Command } from '../shell/types';

// 留言存在自己部署的 Twikoo 里；path 固定，所有留言都进同一个留言板
const TWIKOO = {
  envId: 'https://comments.fishqaq.com',
  path: '/guestbook',
  lang: 'zh-CN',
};

const overlay = document.getElementById('comment')!;
const mount = overlay.querySelector<HTMLElement>('#tcomment')!;
let loading: Promise<void> | null = null;
let onClose: (() => void) | null = null;

/** Twikoo 只在第一次打开时加载（单独打包，不拖慢首屏），之后关掉只是隐藏；加载失败下次打开再试 */
function load() {
  loading ??= import('twikoo')
    .then(({ default: twikoo }) => twikoo.init({ ...TWIKOO, el: mount }))
    .catch(() => {
      loading = null;
      mount.textContent = '留言板加载失败，关掉再打开试试。';
    });
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

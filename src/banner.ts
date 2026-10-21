import { paint } from './shell/ansi';

export const LOGO = [
  '  __ _     _     ',
  ' / _/ |___| |__  ',
  '| |_| / __| \'_ \\ ',
  '|  _| \\__ \\ | | |',
  '|_| |_|___/_| |_|',
];

export function welcome(): string {
  const cmd = (s: string) => paint('32', s);
  const key = (s: string) => paint('33', s);
  return [
    ...LOGO.map((line) => paint('36', line)),
    '',
    `欢迎来到 ${paint('1', 'f1sh')} 的终端主页。`,
    `输入 ${cmd('help')} 查看命令，${cmd('cat about.md')} 认识我，${cmd('projects')} 看看我在做什么。`,
    `${key('Tab')} 补全  ${key('↑↓')} 历史  ${key('Ctrl+R')} 搜索历史  ${key('Ctrl+L')} 清屏`,
    '',
  ].join('\n');
}

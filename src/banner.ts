import { paint } from './shell/ansi';

// figlet Calvin S
export const LOGO = [
  '┌─┐┬┌─┐┬ ┬┌─┐ ┌─┐┌─┐  ┌─┐┌─┐┌┬┐',
  '├┤ │└─┐├─┤│─┼┐├─┤│─┼┐ │  │ ││││',
  '└  ┴└─┘┴ ┴└─┘└┴ ┴└─┘└o└─┘└─┘┴ ┴',
];

export function welcome(): string {
  const cmd = (s: string) => paint('32', s);
  const key = (s: string) => paint('33', s);
  return [
    ...LOGO.map((line) => paint('36', line)),
    '',
    `欢迎来到${paint('1', '咸鱼小窝')}。`,
    `第一次来？输入 ${cmd('cat README.md')} 看看怎么玩，${cmd('help')} 查看所有命令。`,
    `${key('Tab')} 接受灰色提示 / 补全  ${key('↑↓')} 历史  ${key('Ctrl+R')} 搜索历史  ${key('Ctrl+L')} 清屏`,
    '',
  ].join('\n');
}

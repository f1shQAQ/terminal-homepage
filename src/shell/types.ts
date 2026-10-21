import type { Shell } from './shell';

export interface Context {
  /** 不含命令名的参数 */
  args: string[];
  /** 管道上一段的输出，没有管道时为 null */
  stdin: string | null;
  /** 是否是管道最后一段（直接显示在终端上） */
  tty: boolean;
  shell: Shell;
  /** 输出一行或多行，自动补换行 */
  out(text: string): void;
  /** 错误信息直接写到终端，不进管道 */
  err(text: string): void;
}

export interface Command {
  name: string;
  summary: string;
  usage?: string;
  /** 不在 help 里列出 */
  hidden?: boolean;
  /** 路径补全时只补目录 */
  dirsOnly?: boolean;
  /** 自定义参数补全；返回 null 时退回到路径补全 */
  complete?(args: string[], shell: Shell): string[] | null;
  run(ctx: Context): void | Promise<void>;
}

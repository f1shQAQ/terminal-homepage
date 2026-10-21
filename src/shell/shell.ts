import type { Terminal } from '@xterm/xterm';
import type { ThemeController } from '../theme';
import { HOME, displayPath, writeFile } from '../fs/vfs';
import { paint, red } from './ansi';
import { complete } from './completer';
import { History } from './history';
import { parse } from './parser';
import { Readline } from './readline';
import type { Command, Context } from './types';

function distance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export class Shell {
  cwd = HOME;
  readonly commands = new Map<string, Command>();
  readonly history = new History();
  readonly readline: Readline;
  readonly startedAt = Date.now();
  onCwdChange: (cwd: string) => void = () => {};

  constructor(
    readonly term: Terminal,
    readonly theme: ThemeController,
  ) {
    this.readline = new Readline(term, this.history, (before) => complete(before, this));
  }

  register(commands: Command[]) {
    for (const command of commands) {
      this.commands.set(command.name, command);
      if (!command.hidden) writeFile(`/bin/${command.name}`, `#!/usr/bin/tsh\n# ${command.summary}\n`);
    }
  }

  setCwd(abs: string) {
    this.cwd = abs;
    this.onCwdChange(abs);
  }

  prompt(): string {
    return `${paint('1;32', 'guest@fishqaq.com')}:${paint('1;34', displayPath(this.cwd))}$ `;
  }

  async run() {
    for (;;) {
      const line = await this.readline.read(this.prompt());
      await this.execute(line);
    }
  }

  private error(message: string) {
    this.term.write(red(message) + '\n');
  }

  async execute(line: string) {
    if (!line.trim()) return;

    let pipeline: string[][];
    try {
      pipeline = parse(line);
    } catch (e) {
      return this.error(`tsh: ${(e as Error).message}`);
    }

    let stdin: string | null = null;
    for (let i = 0; i < pipeline.length; i++) {
      const [name, ...args] = pipeline[i];
      if (!name) return this.error('tsh: | 附近有语法错误');

      const command = this.commands.get(name);
      if (!command) {
        const names = [...this.commands.values()].filter((c) => !c.hidden).map((c) => c.name);
        const guess = names.find((n) => distance(n, name) <= Math.max(1, Math.floor(n.length / 3)));
        this.error(`tsh: 找不到命令: ${name}`);
        if (guess) this.term.write(`你是不是想输入 ${paint('32', guess)}？\n`);
        else this.term.write(`输入 ${paint('32', 'help')} 查看所有命令。\n`);
        return;
      }

      let output = '';
      const ctx: Context = {
        args,
        stdin,
        tty: i === pipeline.length - 1,
        shell: this,
        out: (text) => (output += text.endsWith('\n') ? text : text + '\n'),
        err: (text) => this.error(text),
      };
      try {
        await command.run(ctx);
      } catch (e) {
        return this.error(`${name}: ${(e as Error).message}`);
      }
      stdin = output;
    }

    if (stdin) this.term.write(stdin);
  }
}

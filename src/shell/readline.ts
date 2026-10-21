import type { Terminal } from '@xterm/xterm';
import type { History } from './history';
import { paint, stripAnsi } from './ansi';
import { charWidth, formatColumns } from './width';

export interface Completion {
  /** 光标前正在补全的那个词 */
  word: string;
  /** 用来替换 word 的完整候选，目录以 / 结尾 */
  candidates: string[];
  /** 列出候选时显示的文字 */
  labels: string[];
}

export type Completer = (before: string) => Completion;

interface SearchState {
  query: string;
  index: number;
  failed: boolean;
  savedBuf: string[];
  savedPos: number;
}

interface Suggestion {
  /** 光标后面显示成灰色的那段 */
  text: string;
  /** 来自历史记录（整段接受），还是来自补全（交给 complete 处理） */
  fromHistory: boolean;
}

const isWordChar = (ch: string) => /[\p{L}\p{N}_]/u.test(ch);
const isSpace = (ch: string) => /\s/.test(ch);

function commonPrefix(items: string[]): string {
  let prefix = Array.from(items[0]);
  for (const item of items.slice(1)) {
    const chars = Array.from(item);
    let i = 0;
    while (i < prefix.length && i < chars.length && prefix[i] === chars[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix.join('');
}

/**
 * 一个 GNU Readline 风格的行编辑器。xterm.js 只负责显示，
 * 光标、换行折返、快捷键、补全、历史都在这里处理。
 */
export class Readline {
  private buf: string[] = [];
  private pos = 0;
  private prompt = '';
  private cursorRow = 0;
  private resolveLine: ((line: string) => void) | null = null;
  private histIndex = -1;
  private draft: string[] = [];
  private killRing = '';
  private lastWasTab = false;
  private search: SearchState | null = null;
  private suggestion: Suggestion | null = null;

  constructor(
    private term: Terminal,
    private history: History,
    private completer: Completer,
  ) {
    term.onData((data) => this.handle(data));
  }

  read(prompt: string): Promise<string> {
    this.prompt = prompt;
    this.buf = [];
    this.pos = 0;
    this.cursorRow = 0;
    this.histIndex = -1;
    this.search = null;
    this.render();
    return new Promise((resolve) => (this.resolveLine = resolve));
  }

  handle(data: string): void {
    if (!this.resolveLine) return;
    if (this.search) return this.handleSearch(data);

    const wasTab = this.lastWasTab;
    this.lastWasTab = false;

    switch (data) {
      case '\r':
        return this.accept();
      case '\x03': // Ctrl+C
        return this.interrupt();
      case '\x04': // Ctrl+D
        return this.buf.length ? this.deleteForward() : this.eof();
      case '\t':
        // 有历史提示时 Tab 整段接受；补全来的提示交给 complete，行为和原来一致
        if (this.suggestion?.fromHistory) return this.insert(this.suggestion.text);
        return this.complete(wasTab);
      case '\x12': // Ctrl+R
        return this.startSearch();
      case '\x0c': // Ctrl+L
        return this.clearScreen();

      case '\x7f': // Backspace
        if (this.pos > 0) this.edit(() => this.buf.splice(--this.pos, 1));
        return;
      case '\x1b[3~': // Delete
        return this.deleteForward();

      case '\x1b[D':
      case '\x1bOD':
      case '\x02': // Ctrl+B
        return this.moveTo(this.pos - 1);
      case '\x1b[C':
      case '\x1bOC':
      case '\x06': // Ctrl+F
        if (this.suggestion) return this.insert(this.suggestion.text);
        return this.moveTo(this.pos + 1);
      case '\x1b[H':
      case '\x1bOH':
      case '\x1b[1~':
      case '\x01': // Ctrl+A
        return this.moveTo(0);
      case '\x1b[F':
      case '\x1bOF':
      case '\x1b[4~':
      case '\x05': // Ctrl+E
        if (this.suggestion) return this.insert(this.suggestion.text);
        return this.moveTo(this.buf.length);
      case '\x1bb': // Alt+B
      case '\x1b[1;5D': // Ctrl+←
      case '\x1b[1;3D':
        return this.moveTo(this.wordStart(isWordChar));
      case '\x1bf': // Alt+F
      case '\x1b[1;5C': // Ctrl+→
      case '\x1b[1;3C':
        // 在行尾时只接受提示里的下一个词
        if (this.suggestion) return this.insert(this.suggestion.text.match(/^[^\p{L}\p{N}_]*[\p{L}\p{N}_]*/u)![0]);
        return this.moveTo(this.wordEnd());

      case '\x1b[A':
      case '\x1bOA':
      case '\x10': // Ctrl+P
        return this.historyMove(-1);
      case '\x1b[B':
      case '\x1bOB':
      case '\x0e': // Ctrl+N
        return this.historyMove(1);

      case '\x15': // Ctrl+U
        return this.kill(0, this.pos);
      case '\x0b': // Ctrl+K
        return this.kill(this.pos, this.buf.length);
      case '\x17': // Ctrl+W（浏览器里通常会先关掉标签页）
        return this.kill(this.wordStart((ch) => !isSpace(ch)), this.pos);
      case '\x1b\x7f': // Alt+Backspace
      case '\x08': // Ctrl+Backspace
        return this.kill(this.wordStart(isWordChar), this.pos);
      case '\x1bd': // Alt+D
      case '\x1b[3;5~': // Ctrl+Delete
        return this.kill(this.pos, this.wordEnd());
      case '\x19': // Ctrl+Y
        return this.insert(this.killRing);
      case '\x14': // Ctrl+T
        return this.transpose();
      case '\x1b.': // Alt+.
      case '\x1b_':
        return this.insertLastArg();
    }

    if (data.startsWith('\x1b')) return;
    this.insert(data);
  }

  // ---------- 编辑 ----------

  private edit(fn: () => void) {
    fn();
    this.render();
  }

  private insert(text: string) {
    const chars = Array.from(text.replace(/\r\n?|\n/g, ' ').replace(/[\x00-\x1f\x7f]/g, ''));
    if (!chars.length) return;
    this.edit(() => {
      this.buf.splice(this.pos, 0, ...chars);
      this.pos += chars.length;
    });
  }

  private deleteForward() {
    if (this.pos < this.buf.length) this.edit(() => this.buf.splice(this.pos, 1));
  }

  private kill(from: number, to: number) {
    if (from >= to) return;
    this.edit(() => {
      this.killRing = this.buf.splice(from, to - from).join('');
      this.pos = from;
    });
  }

  private transpose() {
    if (this.pos === 0 || this.buf.length < 2) return;
    this.edit(() => {
      const i = this.pos === this.buf.length ? this.pos - 1 : this.pos;
      [this.buf[i - 1], this.buf[i]] = [this.buf[i], this.buf[i - 1]];
      this.pos = i + 1;
    });
  }

  private insertLastArg() {
    const last = this.history.all[this.history.all.length - 1];
    const arg = last?.trim().split(/\s+/).pop();
    if (arg) this.insert(arg);
  }

  private moveTo(pos: number) {
    const next = Math.max(0, Math.min(this.buf.length, pos));
    if (next !== this.pos) this.edit(() => (this.pos = next));
  }

  private wordStart(isWord: (ch: string) => boolean): number {
    let i = this.pos;
    while (i > 0 && !isWord(this.buf[i - 1])) i--;
    while (i > 0 && isWord(this.buf[i - 1])) i--;
    return i;
  }

  private wordEnd(): number {
    let i = this.pos;
    while (i < this.buf.length && !isWordChar(this.buf[i])) i++;
    while (i < this.buf.length && isWordChar(this.buf[i])) i++;
    return i;
  }

  // ---------- 提交、中断 ----------

  private finish(line: string) {
    const resolve = this.resolveLine!;
    this.resolveLine = null;
    this.cursorRow = 0;
    resolve(line);
  }

  private accept() {
    this.pos = this.buf.length;
    this.renderPlain();
    this.term.write('\r\n');
    const line = this.buf.join('');
    // 和 bash 的 HISTCONTROL=ignorespace 一样，空格开头的命令不进历史
    if (!line.startsWith(' ')) this.history.push(line);
    this.finish(line);
  }

  private interrupt() {
    this.pos = this.buf.length;
    this.renderPlain();
    this.term.write('^C\r\n');
    this.finish('');
  }

  private eof() {
    this.term.write('exit\r\n');
    this.finish('exit');
  }

  private clearScreen() {
    // 2J 清屏，3J 清掉滚动区，然后在第一行重画当前输入
    this.term.write('\x1b[H\x1b[2J\x1b[3J');
    this.cursorRow = 0;
    this.render();
  }

  // ---------- 历史 ----------

  private historyMove(dir: -1 | 1) {
    const items = this.history.all;
    const from = this.histIndex === -1 ? items.length : this.histIndex;
    const next = from + dir;
    if (next < 0 || next > items.length || next === from) return;
    if (this.histIndex === -1) this.draft = [...this.buf];
    if (next === items.length) {
      this.histIndex = -1;
      this.setBuffer(this.draft);
    } else {
      this.histIndex = next;
      this.setBuffer(Array.from(items[next]));
    }
  }

  private setBuffer(chars: string[]) {
    this.buf = [...chars];
    this.pos = this.buf.length;
    this.render();
  }

  // ---------- Ctrl+R 反向搜索 ----------

  private startSearch() {
    this.suggestion = null;
    this.search = {
      query: '',
      index: this.history.all.length,
      failed: false,
      savedBuf: [...this.buf],
      savedPos: this.pos,
    };
    this.renderSearch();
  }

  private searchMatch(): string {
    const s = this.search!;
    return s.index < this.history.all.length ? this.history.all[s.index] : '';
  }

  private searchFrom(before: number) {
    const s = this.search!;
    if (!s.query) {
      s.index = this.history.all.length;
      s.failed = false;
      return;
    }
    const found = this.history.search(s.query, before);
    if (found >= 0) s.index = found;
    s.failed = found < 0;
  }

  private exitSearch() {
    const s = this.search!;
    const match = this.searchMatch();
    this.search = null;
    if (match) this.setBuffer(Array.from(match));
    else {
      this.buf = s.savedBuf;
      this.pos = s.savedPos;
      this.render();
    }
  }

  private handleSearch(data: string): void {
    const s = this.search!;
    switch (data) {
      case '\x12': // 再按 Ctrl+R 找更早的一条
        this.searchFrom(s.index);
        return this.renderSearch();
      case '\x7f':
        s.query = Array.from(s.query).slice(0, -1).join('');
        this.searchFrom(this.history.all.length);
        return this.renderSearch();
      case '\x07': // Ctrl+G 取消
      case '\x03':
        this.search = null;
        this.buf = s.savedBuf;
        this.pos = s.savedPos;
        return this.render();
      case '\r':
        this.exitSearch();
        return this.accept();
      case '\x1b':
        return this.exitSearch();
    }
    if (data.startsWith('\x1b') || data.charCodeAt(0) < 32) {
      // 其它控制键：先接受当前匹配，再按普通模式处理这个键
      this.exitSearch();
      return this.handle(data);
    }
    s.query += data.replace(/[\x00-\x1f\x7f]/g, '');
    this.searchFrom(Math.min(s.index + 1, this.history.all.length));
    this.renderSearch();
  }

  private renderSearch() {
    const s = this.search!;
    const label = `(${s.failed ? 'failed ' : ''}reverse-i-search)\`${s.query}': `;
    const match = Array.from(this.searchMatch());
    this.draw(label, match, match.length);
  }

  // ---------- 补全 ----------

  private complete(wasTab: boolean) {
    const before = this.buf.slice(0, this.pos).join('');
    const { word, candidates, labels } = this.completer(before);
    if (!candidates.length) return;

    if (candidates.length === 1) {
      const only = candidates[0];
      const needSpace = !only.endsWith('/') && this.buf[this.pos] !== ' ';
      return this.replaceWord(word, only + (needSpace ? ' ' : ''));
    }

    const prefix = commonPrefix(candidates);
    this.lastWasTab = true;
    if (prefix.length > word.length) this.replaceWord(word, prefix);
    else if (wasTab) this.printAbove(formatColumns(labels, this.term.cols));
  }

  private replaceWord(word: string, text: string) {
    const removed = Array.from(word).length;
    const chars = Array.from(text);
    this.edit(() => {
      this.buf.splice(this.pos - removed, removed, ...chars);
      this.pos += chars.length - removed;
    });
  }

  /** 在当前输入行下面打印内容，然后重新画提示符和输入 */
  private printAbove(text: string) {
    const pos = this.pos;
    this.pos = this.buf.length;
    this.renderPlain();
    this.term.write('\r\n' + text.replace(/\n/g, '\r\n') + '\r\n');
    this.cursorRow = 0;
    this.pos = pos;
    this.render();
  }

  // ---------- 绘制 ----------

  private render() {
    this.suggestion = this.suggest();
    this.draw(this.prompt, this.buf, this.pos, this.suggestion?.text ?? '');
  }

  /** 不带灰色提示地重画，用于回车、Ctrl+C 这类要把这一行定下来的时候 */
  private renderPlain() {
    this.suggestion = null;
    this.draw(this.prompt, this.buf, this.pos);
  }

  /**
   * 光标在行尾时，先从历史里找以当前输入开头的最近一条（像 fish），
   * 找不到再看补全：唯一候选或候选的公共前缀比当前词长，就提示多出来的部分。
   */
  private suggest(): Suggestion | null {
    if (this.pos !== this.buf.length) return null;
    const line = this.buf.join('');
    if (!line.trim()) return null;

    const items = this.history.all;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].length > line.length && items[i].startsWith(line)) {
        return { text: items[i].slice(line.length), fromHistory: true };
      }
    }

    const { word, candidates } = this.completer(line);
    if (!word || !candidates.length) return null;
    const target = candidates.length === 1 ? candidates[0] : commonPrefix(candidates);
    return target.length > word.length ? { text: target.slice(word.length), fromHistory: false } : null;
  }

  /**
   * 从提示符所在行的行首开始整行重画，自己计算折行，
   * 再把光标放回 cursor 对应的格子。cursorRow 记录光标相对提示符起始行的行数。
   */
  private draw(prompt: string, chars: string[], cursor: number, ghost = '') {
    const cols = this.term.cols;
    let out = '';
    if (this.cursorRow > 0) out += `\x1b[${this.cursorRow}A`;
    out += '\r\x1b[J' + prompt + chars.join('') + (ghost ? paint('90', ghost) : '');

    let row = 0;
    let col = 0;
    let curRow = 0;
    let curCol = 0;
    const place = (ch: string, index: number) => {
      const w = charWidth(ch);
      // 宽字符放不下最后一格时，终端会把它挪到下一行
      if (w === 2 && col === cols - 1) {
        row++;
        col = 0;
      }
      if (index === cursor) {
        curRow = row;
        curCol = col;
      }
      col += w;
      if (col >= cols) {
        row++;
        col = 0;
      }
    };
    Array.from(stripAnsi(prompt)).forEach((ch) => place(ch, -1));
    chars.forEach(place);
    if (cursor >= chars.length) {
      curRow = row;
      curCol = col;
    }
    // 灰色提示画在光标后面，只参与折行计算，不影响光标位置
    Array.from(ghost).forEach((ch) => place(ch, -1));

    // 正好写满一行时终端处于"待折行"状态，手动换行让光标落到下一行行首
    if (col === 0 && row > 0) out += '\r\n';
    if (row > curRow) out += `\x1b[${row - curRow}A`;
    out += `\x1b[${curCol + 1}G`;

    this.cursorRow = curRow;
    this.term.write(out);
  }
}

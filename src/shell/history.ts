const STORAGE_KEY = 'term:history';
const MAX_ITEMS = 500;

export class History {
  private items: string[] = [];

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(saved)) this.items = saved.filter((x): x is string => typeof x === 'string');
    } catch {
      // 读不到就从空历史开始
    }
  }

  get all(): readonly string[] {
    return this.items;
  }

  push(line: string) {
    if (!line.trim() || this.items[this.items.length - 1] === line) return;
    this.items.push(line);
    if (this.items.length > MAX_ITEMS) this.items.splice(0, this.items.length - MAX_ITEMS);
    this.save();
  }

  clear() {
    this.items = [];
    this.save();
  }

  // 从 before 往前找最近一条包含 query 的记录，找不到返回 -1
  search(query: string, before: number): number {
    for (let i = Math.min(before, this.items.length) - 1; i >= 0; i--) {
      if (this.items[i].includes(query)) return i;
    }
    return -1;
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      // 存不下就只保留在内存里
    }
  }
}

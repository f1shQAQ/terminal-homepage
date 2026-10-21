export interface FileNode {
  type: 'file';
  name: string;
  content: string;
}

export interface DirNode {
  type: 'dir';
  name: string;
  children: Map<string, FsNode>;
}

export type FsNode = FileNode | DirNode;

export const HOME = '/home/guest';

const root: DirNode = { type: 'dir', name: '', children: new Map() };

function mkdirp(parts: string[]): DirNode {
  let dir = root;
  for (const part of parts) {
    let next = dir.children.get(part);
    if (!next) {
      next = { type: 'dir', name: part, children: new Map() };
      dir.children.set(part, next);
    }
    if (next.type !== 'dir') throw new Error(`${part} 不是目录`);
    dir = next;
  }
  return dir;
}

export function writeFile(abs: string, content: string) {
  const parts = abs.split('/').filter(Boolean);
  const name = parts.pop()!;
  mkdirp(parts).children.set(name, { type: 'file', name, content });
}

export function normalize(path: string, cwd: string): string {
  if (path === '~' || path.startsWith('~/')) path = HOME + path.slice(1);
  const abs = path.startsWith('/') ? path : `${cwd}/${path}`;
  const parts: string[] = [];
  for (const part of abs.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return '/' + parts.join('/');
}

export function lookup(abs: string): FsNode | null {
  let node: FsNode = root;
  for (const part of abs.split('/').filter(Boolean)) {
    if (node.type !== 'dir') return null;
    const next = node.children.get(part);
    if (!next) return null;
    node = next;
  }
  return node;
}

export const resolve = (path: string, cwd: string) => lookup(normalize(path, cwd));

export function displayPath(abs: string): string {
  if (abs === HOME) return '~';
  if (abs.startsWith(HOME + '/')) return '~' + abs.slice(HOME.length);
  return abs;
}

export function listDir(dir: DirNode, all = false): FsNode[] {
  return [...dir.children.values()]
    .filter((n) => all || !n.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// content/ 下的文件在构建时打包进来，挂到 /home/guest
const files = import.meta.glob('../../content/**/*', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;
for (const [path, content] of Object.entries(files)) {
  writeFile(HOME + path.slice('../../content'.length), content);
}

mkdirp(['tmp']);
writeFile('/etc/hostname', 'f1sh\n');
writeFile('/etc/motd', '欢迎光临。这里的一切都只存在于你的浏览器里。\n');
writeFile(`${HOME}/.secret`, '恭喜你发现了隐藏文件 🎉\n用 ls -a 能看到所有以 . 开头的文件。\n');

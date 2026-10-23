# terminal-homepage

仿 Linux 终端的个人主页。Vite + TypeScript + xterm.js，行编辑器、补全和虚拟文件系统是自己写的。

## 开发

```bash
npm install
npm run dev
```

## 改内容

- `content/` 里的文件会挂到虚拟文件系统的 `/home/guest`，访客用 `ls`、`cat` 查看。
- `content/projects/*.md` 会被 `projects` 命令列出：第一行 `# 标题`，第一段文字是简介。
- `index.html` 里的 `#fallback` 是给搜索引擎和禁用 JS 的访客看的纯文本版本，改了内容记得同步。

## 加命令

在 `src/commands/` 里写一个 `Command` 对象，加进对应文件末尾的数组。`complete` 返回参数候选，返回 `null` 时补全路径。

## 部署

```bash
npm run build
```

把 `dist/` 放到 GitHub Pages、Cloudflare Pages 或任意静态托管即可。

## 代码结构

| 文件 | 作用 |
|---|---|
| `src/theme.ts` | 读取 `prefers-color-scheme`，监听系统切换，同步 xterm 配色和 CSS 变量 |
| `src/shell/readline.ts` | 行编辑、折行绘制、快捷键、历史导航、Ctrl+R、灰色提示、Tab 补全 |
| `src/shell/completer.ts` | 补命令名、命令参数、路径 |
| `src/shell/shell.ts` | 命令循环、管道、找不到命令时的拼写提示 |
| `src/fs/vfs.ts` | 虚拟文件系统 |
| `src/commands/` | 所有命令 |
| `src/commands/comment.ts` | 留言板弹窗，基于 giscus，留言存在 `f1shQAQ/blog-community` 的 Discussions（`Home-Page` 分类） |

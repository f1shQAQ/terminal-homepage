# terminal-homepage

你现在看到的这个网站：一个仿 Linux 终端的个人主页。

## 特性

- 跟随系统自动切换深色 / 浅色主题，也能用 `theme` 命令手动切换
- Tab 补全命令和路径，↑↓ 翻历史，Ctrl+R 搜索历史
- 支持 Ctrl+A / E / U / K、Alt+B / F 等常用快捷键
- 支持管道：`cat about.md | grep 技术`

## 技术

Vite + TypeScript + xterm.js，行编辑器和虚拟文件系统是自己写的。

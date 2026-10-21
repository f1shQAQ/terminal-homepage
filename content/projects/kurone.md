# Kurone 黒音

为 Shirone 主题博客打造的网页端管理面板：没有数据库，没有服务器，所有改动都是博客仓库里的一次 commit。

GitHub：https://github.com/f1shQAQ/kurone

## 特性

- 纯静态 + GitHub API：Svelte 5 单页应用直接读写博客仓库
- 改动先暂存在浏览器里，确认后合并成一个 commit，托管平台自动重建博客
- 局部替换源码，没改的条目和注释原样保留，保存前展示 diff
- 编辑文章、动态、友链、项目等数据和站点配置，图片粘贴即上传
- 可选 AI 生成摘要和 slug，可选 Telegram 机器人发动态

## 部署

Cloudflare Workers 或 Vercel，都支持一键部署。

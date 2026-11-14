# 柚子的blog

<https://youzilm.top>

一个部署在 Cloudflare 上的双语个人博客。文章是仓库里的 Markdown，构建时生成静态页面；评论和阅读量使用 Cloudflare D1。

## 技术栈

- Next.js 16（App Router）
- Cloudflare Workers + OpenNext
- Cloudflare D1（阅读量、Waline 评论）
- Waline_On_Worker（Workers 上的 Waline 社区实现）
- Markdown + Shiki + KaTeX
- Noto Serif SC

## 功能

- 文章、归档、标签、作品、留言板、友链、现在、关于、搜索
- 中英双语；同 slug 的中英文文件是同一篇文章的两个版本
- 英文缺失时回退中文原文
- 全文搜索（`Cmd/Ctrl + K`）
- 文章目录：
  - 宽屏：右侧粘性轨道，圆点随阅读进度移动，当前章节高亮、上一节渐淡、下一节渐亮
  - 窄屏：右侧圆环显示阅读进度，hover 左移放大，点击展开贴边目录面板
- 深色模式、页面切换动画、控件开合动画
- 代码高亮与复制、KaTeX 数学公式、图片放大、脚注、提示块
- Waline 评论、选中正文引用评论、阅读量
- RSS、sitemap、robots、OG 图、结构化数据
- 独立 Cloudflare 管理后台：GitHub 内容保存、双语编辑、图片、评论、Actions 发布
- 命令行工具：写文章、翻译、改页面文本、管理评论、部署

## 本地开发

需要 Node.js 20+（本项目在 Node 24 下开发）。

```bash
npm install
npm run dev
```

`npm run dev` 会先生成内容索引，然后启动 Next.js 并监听 `content/` 和 `public/images/`。修改 Markdown 后会自动重新生成。

常用命令：

```bash
npm run blog        # 启动后台开发服务器
npm run blog-cli -- help   # 脚本化 CLI
npm run content   # 手动重新生成内容
npm run build     # 生产构建
npm run preview   # 在本地 Workers 运行时预览（会先应用本地 D1 migration）
npm run deploy    # 部署到 Cloudflare（读取 .env.local）
npm run admin:check # 对独立后台做 TypeScript 检查
```

`npm run blog -- <command>` 仍会把参数转交给 CLI，所以旧命令继续可用；新习惯建议用
`npm run blog-cli -- <command>`。

## 内容结构

```text
content/
  posts/
    zh/<slug>.md       中文文章
    en/<slug>.md       英文翻译（slug 与中文一致）
  pages/
    zh/about.md        关于页
    zh/now.md          现在页
    en/about.md
    en/now.md
  tags.json            标签 key 与中英文显示名
  projects.json        作品页
  links.json           友链与常去的地方
  site.json            站点名称、作者、简介、社交链接等
  ui.json              站内 UI 文案覆盖（管理后台编辑）
public/
  images/              文章图片
  icon-192.png         站点图标（来自旧站 哈气.xyz 的 icon）
  og.png               默认分享图
assets/
  icon.png             站点图标源文件
```

文章 frontmatter：

```md
---
title: 标题
date: 2026-11-13
summary: 一句话摘要（可选，缺省会从正文截取）
tags: [programming, notes]
draft: false
---

正文……
```

- `tags` 使用 `content/tags.json` 里的 key，例如 `programming`、`reverse-engineering`、`notes`。
- `draft: true` 的文章不会构建到站点。
- 英文文章缺失时，`/en/...` 会显示中文原文，并标记为中文 fallback。
- 中英文同 slug 视为同一篇文章：列表、归档、标签、搜索、评论和阅读量都只按一篇文章处理。
- 文章标签以中文版本的 frontmatter 为准，英文版本复用同一组 tag key。
- 关于页和现在页也按 slug 分组：`about` 的 zh / en 是同一个页面的两个版本，`now` 同理。
- 图片写成 `![alt](/images/example.png "图注")`，会自动生成 `<figure>` 和图注。
- 支持 GFM 表格、任务列表、脚注、`> [!NOTE]` 提示块、KaTeX、`<details>`。

## 独立管理后台

TUI 已迁移为部署在 Cloudflare 的独立管理网站。支持文章、双语页面、Markdown 预览、标签、作品、友链、图片、站点与 UI 文案、评论审核及发布记录。内容通过 GitHub 保存，GitHub Actions 自动发布博客。

完整的登录配置、仓库权限、部署与冲突处理见 [admin/README.md](admin/README.md)。

```bash
npm run admin:dev     # 本地后台：http://localhost:8788
npm run admin:check   # 后台 TypeScript 检查
npm run admin:build   # 构建检查，不部署
npm run admin:deploy  # 发布独立后台
npm test             # 回归与后台交互测试
```

## CLI

```bash
npm run blog-cli -- help
```

### 文章

```bash
npm run blog-cli -- list
npm run blog-cli -- list --lang zh

npm run blog-cli -- new
npm run blog-cli -- new --title "Hello" --slug hello --tags notes --summary "第一篇"
npm run blog-cli -- new --title "Hello" --slug hello --draft

npm run blog-cli -- edit hello
npm run blog-cli -- edit hello --lang en
npm run blog-cli -- draft hello
npm run blog-cli -- publish hello
npm run blog-cli -- delete hello --yes

npm run blog-cli -- translate hello
```

- `list` 会把同 slug 的 zh/en 合并成一行，`LANGS` 列显示 `zh`、`en` 或 `zh+en`。
- `delete`、`draft`、`publish` 默认同时作用于同一篇文章的所有语言版本；加 `--lang` 只操作其中一个版本。
- `new` 会交互式询问标题、slug、摘要和标签，然后打开编辑器。
- `translate` 会从中文文章创建一份英文草稿（`draft: true`），它只是给同一篇文章加一个英文版本，不会创建第二篇文章。翻译完成后执行
  `npm run blog-cli -- publish <slug> --lang en`。
- 编辑器优先使用 `$VISUAL` / `$EDITOR`，Windows 默认 `notepad`。VS Code 可以设置
  `EDITOR="code --wait"`。
- CLI 修改文章后会重新生成 `content.json` 和搜索索引。

### 页面文本

站点名称、作者、标语、简介、社交链接等集中在 `content/site.json`：

```bash
npm run blog-cli -- text keys
npm run blog-cli -- text get
npm run blog-cli -- text get tagline.zh
npm run blog-cli -- text set tagline.zh "写代码，也写字。"
npm run blog-cli -- text set name.en youzilm
npm run blog-cli -- text set github https://github.com/FallingSkyQwQ
npm run blog-cli -- text set start-year 2026
```

可编辑的 key 用 `text keys` 查看。

关于页和现在页的正文：

```bash
npm run blog-cli -- page about
npm run blog-cli -- page about --lang en
npm run blog-cli -- page now
```

### 评论

评论在 Cloudflare D1 的 Waline 数据库中。需要 `.env.local` 里的
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`，或者已经执行过 `npx wrangler login`。

```bash
npm run blog-cli -- comment list
npm run blog-cli -- comment list --path /articles/hello-world
npm run blog-cli -- comment list --status waiting
npm run blog-cli -- comment list --limit 50 --json

npm run blog-cli -- comment show 12
npm run blog-cli -- comment approve 12
npm run blog-cli -- comment spam 12
npm run blog-cli -- comment delete 12 --yes
npm run blog-cli -- comment reply 12 "谢谢你的留言。"
```

`--local` 可以查询本地 D1，而不是线上数据库。

### 构建与部署

```bash
npm run blog-cli -- content
npm run blog-cli -- build
npm run blog-cli -- dev
npm run blog-cli -- deploy
```

## Cloudflare 部署

### 环境变量

复制 `.env.example` 为 `.env.local`，填入：

```dotenv
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

`.env.local` 已被 `.gitignore` 忽略。`npm run deploy` 和 `npm run blog-cli -- deploy` 都会读取它。

### 主站

1. 创建 D1：

   ```bash
   npx wrangler d1 create youzilm-blog-views
   ```

2. 把返回的 `database_id` 填进 `wrangler.jsonc` 的 `VIEWS_DB`。

3. 部署：

   ```bash
   npm run deploy
   ```

`scripts/deploy.mjs` 会依次执行远程 D1 migration、OpenNext 构建和 `wrangler deploy`。
`wrangler.jsonc` 中已经配置：

- Worker 名称 `youzilm-blog`
- 自定义域名 `youzilm.top`、`www.youzilm.top`（`src/proxy.ts` 会把 www 301 到根域）
- D1 绑定 `VIEWS_DB`
- `nodejs_compat`、`global_fetch_strictly_public`

### Waline

Waline 服务在 `services/waline`，使用社区实现
[Waline_On_Worker](https://github.com/lsy-404/Waline_On_Worker)，数据存放在 D1 `youzilm-waline`。

```bash
cd services/waline
npx pnpm@10.34.6 install --frozen-lockfile

# 首次部署：建表
npx wrangler d1 execute youzilm-waline --remote --config wrangler.toml --file=./schema.sql

# JWT 密钥
npx wrangler secret put JWT_SECRET --config wrangler.toml

# 部署（注意必须带 --config，否则 wrangler 可能读到根目录配置）
npx wrangler deploy --config wrangler.toml
```

后台：<https://waline.youzilm.top/ui>

本地的 `.waline-admin.txt` 保存了首次创建的管理员账号，已被 `.gitignore` 忽略。
登录后请及时修改密码。管理员账号用于审核、删除、回复评论。

`services/waline/wrangler.toml` 中的 `SECURE_DOMAINS` 需要写完整的 origin：

```toml
SECURE_DOMAINS = "https://youzilm.top,https://www.youzilm.top,https://waline.youzilm.top,http://localhost:3000"
```

### 重置阅读量

```bash
npx wrangler d1 execute youzilm-blog-views --remote --command "DELETE FROM views"
```

## 自定义

- 站点信息：`content/site.json`，或 `npm run blog-cli -- text ...`
- 界面文案：`src/lib/i18n.ts`
- 样式：`src/styles/globals.css`
- 文章目录样式：`.toc`、`.toc-ring`、`.toc-panel`
- 图标与 OG 图：`assets/icon.png` 和 `scripts/build-images.mjs`（`npm run images`）
- 搜索索引：`scripts/build-content.mjs` 自动生成 `public/search-index.json`
- 标签：`content/tags.json`
- 作品/友链：`content/projects.json`、`content/links.json`

## 已知限制

- 英文缺失时显示中文原文；补上 `content/posts/en/<slug>.md` 后会自动切换为英文版本。
- 评论后端是社区重写的 Waline，功能和官方 Waline 可能有差异。
- OpenNext 在 Windows 上会提示未完全兼容；本地开发和部署可用，但如果遇到构建问题，建议在 WSL 中执行 `npm run deploy`。
- 文章与阅读量是构建时静态内容和 D1 动态数据，新增文章后需要重新部署。

## 许可

文章内容默认以 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 授权。
站点代码的许可请以仓库中的声明为准；未单独声明时保留所有权利。

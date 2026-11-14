# 独立管理后台

后台是一个独立 Cloudflare Worker，主站仍使用 Next.js + OpenNext。内容保存到 GitHub 仓库
`FallingSkyQwQ/youzilm-dot-top` 的 `main` 分支。保存产生提交，GitHub Actions 自动重新发布博客。

## 已迁移的功能

- 概览与文章列表：搜索、草稿筛选、中英版本合并。
- 文章：创建、元数据、Markdown 编辑与预览、大纲跳转、片段插入、翻译草稿、发布、
  同时重命名两个语言版本、删除单个或全部语言版本。
- 关于 / 现在：双语正文及元数据，一次保存两个版本。
- 标签、作品及排序、友链：表单增删改。
- 站点信息与界面文案：中英文编辑、恢复默认。
- 图片库：上传、复制 Markdown、删除图片。
- 评论：使用现有 Waline 管理员登录，按状态或路径筛选、分页、审核、回复和删除。
- 发布记录：查看 Actions 状态和日志、手动重新发布。
- Ctrl / Cmd + S 保存；文章与页面修改自动保留为当前浏览器的本机草稿。

TUI 源码、入口、依赖及二进制构建脚本已移除。CLI 保留，供脚本及本地维护使用。

## 配置

仓库、分支、管理员邮箱与评论服务地址在 [wrangler.jsonc](./wrangler.jsonc) 中。
管理员邮箱为 `charlie.0111@foxmail.com`，也是内容提交署名邮箱。
当前后台地址：[youzilm-blog-admin.wc431515.workers.dev](https://youzilm-blog-admin.wc431515.workers.dev)。
后台默认使用独立 Worker 的 workers.dev 地址；自定义域名可在 Cloudflare Worker 中添加。

生产环境需要设置三个 Worker secrets：

```bash
npx wrangler secret put ADMIN_PASSWORD --config admin/wrangler.jsonc
npx wrangler secret put ADMIN_SESSION_SECRET --config admin/wrangler.jsonc
npx wrangler secret put GITHUB_TOKEN --config admin/wrangler.jsonc
```

- `ADMIN_PASSWORD`：至少 12 位，登录需要邮箱和密码。
- `ADMIN_SESSION_SECRET`：至少 32 位随机字符串，签名后台会话。
- `GITHUB_TOKEN`：建议使用仅授权此仓库的 fine-grained personal access token，
  Contents 读写、Actions 读写。令牌只在 Worker 中使用，不返回浏览器。
- 登录每个 IP 每分钟最多尝试 5 次；会话 8 小时过期，Cookie 使用 HttpOnly /
  SameSite=Strict，HTTPS 下启用 Secure。写操作校验同源和 CSRF token。

本地开发创建 `admin/.dev.vars`（已忽略），填入上述三个 secrets。
不要把真实密钥写入配置文件或提交到仓库。

```bash
npm install
npm run admin:dev      # http://localhost:8788
npm run admin:check
npm run admin:build    # Worker 构建检查，不部署
npm run admin:deploy   # 部署后台
```

`npm run blog` 现在启动后台开发服务器。`npm run blog-cli -- help` 继续提供命令行操作。
后台命令会加载根目录的 `.env.local`，其中的 Cloudflare API token / account id 可复用。

## 自动发布博客

仓库中包含：

- `.github/workflows/deploy.yml`：内容或主站源码变更后，检查并发布博客。
- `.github/workflows/admin.yml`：后台源码变更后，检查并发布后台。

在 GitHub 仓库 Actions secrets 配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。
Cloudflare token 需要发布 Workers 和执行当前 D1 migration 的权限。
Worker secrets 仍通过上面的 `wrangler secret put` 设置；Actions 不会将它们写入源码。

默认只发布 `main` 分支。如果使用其他分支，同时修改后台的 `GITHUB_BRANCH`，
并设置 GitHub repository variable `BLOG_BRANCH`。主站发布工作流保持名为 `deploy.yml`，
或同步修改后台的 `DEPLOY_WORKFLOW`。

GitHub token 保存内容触发 push 工作流；Actions 读写权限用于查看状态及手动触发发布。
当前部署通过 `gh auth token` 复用本机 GitHub CLI 授权，并将令牌存为 Worker secret。
受保护分支需要允许该管理员令牌提交，否则后台会报告失败并保留本机草稿。
GitHub Actions 发布主站与后台，不会自动发布 Waline 服务；修改评论服务后，按其 README 单独部署。

## 保存与冲突

后台读取 GitHub 当前 commit SHA，保存时验证 SHA，多个文件在同一个提交中更新。
分支更新使用 `force: false`。其他编辑者先保存后，后台返回冲突，不覆盖新内容，
浏览器保留正文和本机草稿。下载草稿、刷新最新内容并对照合并后再保存。

“保存到 GitHub”与“发布到博客”是两个阶段。保存后可到发布记录查看是否构建成功。
图片在主站发布完成后可用。每次请求最多提交 40 个文件；单个内容文件最多 256 KB，
图片最多 5 MB；目前一个仓库最多读取 400 个内容文件。

预览支持 GFM、表格、代码及数学公式；发布时主站添加完整代码高亮、图片图注等处理。
预览 iframe 禁止脚本执行，评论原文在管理列表中以纯文本显示。
Markdown 自带的原始 HTML 在当前预览中不会执行。

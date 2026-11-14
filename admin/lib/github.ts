import { HttpError, type Env } from "../types";
import { managedText, managedImage, validateFile } from "./content";
export type TreeEntry = { path: string; sha: string; type: string; mode: string; size?: number };
export type Snapshot = { head: string; files: Record<string, { sha: string; content: string }>; images: TreeEntry[] };
export type Change = { path: string; content: string | null; encoding?: "base64" };
export class GitHub {
  constructor(private env: Env, private fetcher: typeof fetch = fetch) {}
  async request<T>(route: string, method = "GET", body?: unknown): Promise<T> {
    if (!this.env.GITHUB_TOKEN || !this.env.GITHUB_OWNER || !this.env.GITHUB_REPO) throw new HttpError(503, "请先配置 GitHub 仓库和 GITHUB_TOKEN。");
    const base = "https://api.github.com/repos/" + encodeURIComponent(this.env.GITHUB_OWNER) + "/" + encodeURIComponent(this.env.GITHUB_REPO);
    const response = await this.fetcher(base + route, {
      method, headers: { Authorization: "Bearer " + this.env.GITHUB_TOKEN, Accept: "application/vnd.github+json",
        "Content-Type": "application/json", "User-Agent": "youzilm-blog-admin", "X-GitHub-Api-Version": "2022-11-28" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      if ([409, 422].includes(response.status)) throw new HttpError(409, "仓库已更新或提交被拒绝，请重新加载后合并修改。");
      if (response.status === 404) throw new HttpError(502, "GitHub 仓库、分支或工作流不存在，或 Token 没有访问权限。");
      if ([401, 403].includes(response.status)) throw new HttpError(502, "GitHub 授权失败或请求额度已用完，请检查 Token。");
      throw new HttpError(502, "GitHub 请求失败（" + response.status + "）。");
    }
    return (response.status === 204 ? {} : await response.json()) as T;
  }
  branch() { return this.env.GITHUB_BRANCH || "main"; }
  async head() {
    return (await this.request<{ object: { sha: string } }>("/git/ref/heads/" + encodeURIComponent(this.branch()))).object.sha;
  }
  async snapshot(): Promise<Snapshot> {
    const head = await this.head();
    const commit = await this.request<{ tree: { sha: string } }>("/git/commits/" + head);
    const tree = await this.request<{ tree: TreeEntry[]; truncated: boolean }>("/git/trees/" + commit.tree.sha + "?recursive=1");
    if (tree.truncated) throw new HttpError(413, "仓库文件列表过大，请将博客内容放入独立仓库。");
    const entries = tree.tree.filter(row => row.type === "blob" && managedText(row.path));
    if (entries.length > 400) throw new HttpError(413, "当前后台支持最多 400 个内容文件。");
    const files: Snapshot["files"] = {};
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(6, entries.length) }, async () => {
      while (cursor < entries.length) {
        const entry = entries[cursor++];
        if ((entry.size || 0) > 256000) throw new HttpError(413, entry.path + " 超过 256 KB。");
        const blob = await this.request<{ content: string; encoding: string }>("/git/blobs/" + entry.sha);
        if (blob.encoding !== "base64") throw new HttpError(502, "GitHub 内容编码不支持。");
        const content = new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g, "")), char => char.charCodeAt(0)));
        files[entry.path] = { sha: entry.sha, content };
      }
    }));
    return { head, files, images: tree.tree.filter(row => row.type === "blob" && managedImage(row.path)) };
  }
  async save(baseSha: string, changes: Change[], message: string) {
    if (!/^[a-f0-9]{40}$/.test(baseSha) || !changes.length || changes.length > 40) throw new HttpError(400, "提交参数无效。");
    const seen = new Set();
    for (const change of changes) {
      if (!change || typeof change.path !== "string" || seen.has(change.path)) throw new HttpError(400, "同一文件不能重复提交。");
      seen.add(change.path);
      if (change.content === null) {
        if ((!managedText(change.path) && !managedImage(change.path)) || (change.path.startsWith("content/") && !change.path.includes("/posts/"))) throw new HttpError(400, "不允许删除此文件。");
      } else if (typeof change.content !== "string") throw new HttpError(400, "文件内容无效。");
      else if (change.encoding === "base64") {
        if (!managedImage(change.path) || !/^[A-Za-z0-9+/]*={0,2}$/.test(change.content) || change.content.length > 7000000) throw new HttpError(400, "图片格式或大小无效。");
      } else validateFile(change.path, change.content);
    }
    if (await this.head() !== baseSha) throw new HttpError(409, "保存失败：仓库在编辑期间已更新。你的草稿仍保留，请重新加载并合并修改。");
    const parent = await this.request<{ tree: { sha: string } }>("/git/commits/" + baseSha);
    const treeItems = [];
    for (const change of changes) {
      if (change.content === null) treeItems.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      else if (change.encoding === "base64") {
        const blob = await this.request<{ sha: string }>("/git/blobs", "POST", { content: change.content, encoding: "base64" });
        treeItems.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
      } else treeItems.push({ path: change.path, mode: "100644", type: "blob", content: change.content });
    }
    const tree = await this.request<{ sha: string }>("/git/trees", "POST", { base_tree: parent.tree.sha, tree: treeItems });
    const commit = await this.request<{ sha: string }>("/git/commits", "POST", {
      message: message.slice(0, 200) || "content: update from blog admin", tree: tree.sha, parents: [baseSha],
      ...(this.env.ADMIN_EMAIL ? { author: { name: "Blog admin", email: this.env.ADMIN_EMAIL } } : {}),
    });
    await this.request("/git/refs/heads/" + encodeURIComponent(this.branch()), "PATCH", { sha: commit.sha, force: false });
    return { head: commit.sha, url: "https://github.com/" + this.env.GITHUB_OWNER + "/" + this.env.GITHUB_REPO + "/commit/" + commit.sha };
  }
  async deployments() {
    return this.request<{ workflow_runs: unknown[] }>("/actions/workflows/" + encodeURIComponent(this.env.DEPLOY_WORKFLOW || "deploy.yml") + "/runs?branch=" + encodeURIComponent(this.branch()) + "&per_page=10");
  }
  async deploy() {
    return this.request("/actions/workflows/" + encodeURIComponent(this.env.DEPLOY_WORKFLOW || "deploy.yml") + "/dispatches", "POST", { ref: this.branch() });
  }
}

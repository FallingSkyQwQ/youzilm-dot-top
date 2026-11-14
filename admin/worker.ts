import { authenticate, checkOrigin, cookie, setCookie, signSession, verifyPassword, verifySession } from "./lib/auth";
import { GitHub, type Change } from "./lib/github";
import { parseDocument, serializeDocument, uiDefaults, validateFile } from "./lib/content";
import { HttpError, type Env } from "./types";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers } });
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(415, "请发送 JSON 请求。");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请求内容为空。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 7500000) { await reader.cancel(); throw new HttpError(413, "请求内容过大。"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, "请求 JSON 格式无效。"); }
}
async function waline(env: Env, route: string, token = "", method = "GET", payload?: unknown) {
  const base = new URL(env.WALINE_URL || "https://waline.youzilm.top");
  if (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1") throw new HttpError(503, "评论服务必须使用 HTTPS。");
  const response = await fetch(base.origin + "/api/" + route, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload), redirect: "error", signal: AbortSignal.timeout(20000),
  });
  const data = await response.json() as { errno: number; errmsg?: string; data?: Record<string, unknown> };
  if (!response.ok || data.errno) throw new HttpError(response.status === 401 || response.status === 403 ? 401 : 502, data.errmsg || "评论服务请求失败。");
  return data;
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const route = url.pathname;
  if (!route.startsWith("/api/")) {
    const response = await env.ASSETS.fetch(request);
    const secured = new Response(response.body, response);
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "same-origin");
    secured.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    return secured;
  }
  if (route === "/api/session" && request.method === "GET") {
    const session = await verifySession(cookie(request, "blog_admin"), env.ADMIN_SESSION_SECRET);
    return json({ authenticated: !!session, csrf: session?.csrf, configured: !!env.ADMIN_PASSWORD && !!env.ADMIN_SESSION_SECRET,
      repository: env.GITHUB_OWNER && env.GITHUB_REPO ? env.GITHUB_OWNER + "/" + env.GITHUB_REPO : "", branch: env.GITHUB_BRANCH || "main" });
  }
  if (route === "/api/login" && request.method === "POST") {
    checkOrigin(request);
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12 || !env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) throw new HttpError(503, "请配置至少 12 位 ADMIN_PASSWORD 和至少 32 位 ADMIN_SESSION_SECRET。");
    if (!env.ADMIN_LOGIN_LIMITER) throw new HttpError(503, "登录限流尚未配置。");
    if (!(await env.ADMIN_LOGIN_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "local" })).success) throw new HttpError(429, "登录尝试过多，请一分钟后重试。");
    const data = await body(request);
    if (typeof data.email !== "string" || data.email.toLowerCase() !== env.ADMIN_EMAIL?.toLowerCase() || typeof data.password !== "string" || !await verifyPassword(data.password, env.ADMIN_PASSWORD)) throw new HttpError(401, "邮箱或密码不正确。");
    const csrf = crypto.randomUUID();
    const value = await signSession({ kind: "admin", csrf, expires: Date.now() + 28800000 }, env.ADMIN_SESSION_SECRET);
    return json({ csrf }, 200, { "Set-Cookie": setCookie(request, "blog_admin", value) });
  }
  const session = await authenticate(request, env);
  if (route === "/api/logout" && request.method === "POST") {
    const response = json({ ok: true });
    response.headers.append("Set-Cookie", setCookie(request, "blog_admin", "", 0));
    response.headers.append("Set-Cookie", setCookie(request, "blog_waline", "", 0));
    return response;
  }
  const github = new GitHub(env);
  if (route === "/api/snapshot" && request.method === "GET") {
    const snapshot = await github.snapshot();
    const documents: Record<string, ReturnType<typeof parseDocument>> = {};
    for (const [path, file] of Object.entries(snapshot.files)) {
      if (path.endsWith(".md")) documents[path] = parseDocument(file.content);
    }
    return json({ ...snapshot, documents, uiDefaults });
  }
  if (route === "/api/save" && request.method === "POST") {
    const data = await body(request);
    if (typeof data.baseSha !== "string" || !Array.isArray(data.changes) || typeof data.message !== "string") throw new HttpError(400, "保存参数无效。");
    return json(await github.save(data.baseSha, data.changes as Change[], data.message));
  }
  if (route === "/api/articles" && request.method === "POST") {
    const data = await body(request);
    if (typeof data.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(data.slug) || typeof data.baseSha !== "string") throw new HttpError(400, "文章 slug 无效。");
    const original = typeof data.originalSlug === "string" ? data.originalSlug : data.slug;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(original)) throw new HttpError(400, "原始 slug 无效。");
    if (!data.versions || typeof data.versions !== "object") throw new HttpError(400, "文章内容无效。");
    const versions = data.versions as Record<string, { data: Record<string, unknown>; body: string }>;
    const changes: Change[] = [];
    for (const locale of ["zh", "en"]) {
      const doc = versions[locale];
      if (!doc) continue;
      if (!doc.data || typeof doc.data !== "object" || Array.isArray(doc.data) || typeof doc.body !== "string") throw new HttpError(400, "文章内容无效。");
      const meta = { ...doc.data, tags: versions.zh?.data?.tags || doc.data.tags || [] };
      const path = "content/posts/" + locale + "/" + data.slug + ".md";
      const content = serializeDocument(meta, doc.body); validateFile(path, content);
      changes.push({ path, content });
      if (original !== data.slug) changes.push({ path: "content/posts/" + locale + "/" + original + ".md", content: null });
    }
    const snapshot = await github.snapshot();
    if (snapshot.head !== data.baseSha) throw new HttpError(409, "仓库已经更新，请重新加载并合并草稿。");
    if (original !== data.slug && ["zh", "en"].some(l => snapshot.files["content/posts/" + l + "/" + data.slug + ".md"])) throw new HttpError(409, "目标 slug 已存在，请换一个名称。");
    // A new article cannot overwrite an existing file.
    if (data.isNew === true && ["zh", "en"].some(l => snapshot.files["content/posts/" + l + "/" + data.slug + ".md"])) throw new HttpError(409, "文章已存在，请换一个 slug。");
    return json(await github.save(data.baseSha, changes, "content: save article " + data.slug));
  }
  if (route === "/api/document" && request.method === "POST") {
    const data = await body(request);
    if (typeof data.path !== "string" || typeof data.baseSha !== "string" || !data.data || typeof data.data !== "object" || Array.isArray(data.data) || typeof data.body !== "string") throw new HttpError(400, "页面内容无效。");
    const content = serializeDocument(data.data as Record<string, unknown>, data.body);
    validateFile(data.path, content);
    return json(await github.save(data.baseSha, [{ path: data.path, content }], "content: save " + data.path));
  }
  if (route === "/api/pages" && request.method === "POST") {
    const data = await body(request);
    if (!["about", "now"].includes(String(data.slug)) || typeof data.baseSha !== "string" || !data.versions || typeof data.versions !== "object") throw new HttpError(400, "页面参数无效。");
    const changes: Change[] = [];
    for (const locale of ["zh", "en"]) {
      const doc = (data.versions as Record<string, { data: Record<string, unknown>; body: string }>)[locale];
      if (!doc) continue;
      if (!doc.data || typeof doc.data !== "object" || Array.isArray(doc.data) || typeof doc.body !== "string") throw new HttpError(400, "页面内容无效。");
      const path = "content/pages/" + locale + "/" + data.slug + ".md";
      const content = serializeDocument(doc.data, doc.body); validateFile(path, content);
      changes.push({ path, content });
    }
    return json(await github.save(data.baseSha, changes, "content: save page " + data.slug));
  }
  if (route === "/api/preview" && request.method === "POST") {
    const data = await body(request);
    if (typeof data.markdown !== "string" || data.markdown.length > 256000) throw new HttpError(400, "预览内容过大。");
    const html = await unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkRehype)
      .use(rehypeKatex, { strict: false }).use(rehypeStringify).process(data.markdown);
    return json({ html: String(html) });
  }
  if (route === "/api/deployments" && request.method === "GET") return json(await github.deployments());
  if (route === "/api/deploy" && request.method === "POST") { await github.deploy(); return json({ ok: true }); }
  if (route === "/api/comments/login" && request.method === "POST") {
    const data = await body(request);
    const result = await waline(env, "token", "", "POST", { email: data.email, password: data.password, code: data.code });
    if (result.data?.type !== "administrator" || typeof result.data?.token !== "string") throw new HttpError(403, "需要 Waline 管理员账号。");
    const value = await signSession({ kind: "waline", csrf: session.csrf, token: result.data.token, expires: Date.now() + 28800000 }, env.ADMIN_SESSION_SECRET);
    return json({ ok: true }, 200, { "Set-Cookie": setCookie(request, "blog_waline", value) });
  }
  if (route.startsWith("/api/comments")) {
    const walineSession = await verifySession(cookie(request, "blog_waline"), env.ADMIN_SESSION_SECRET, "waline");
    if (!walineSession?.token || walineSession.csrf !== session.csrf) throw new HttpError(401, "请先登录评论管理员账号。");
    if (route === "/api/comments" && request.method === "GET") {
      const query = new URLSearchParams({ type: "list", pageSize: "20", page: url.searchParams.get("page") || "1" });
      for (const k of ["status", "path", "keyword"]) if (url.searchParams.get(k)) query.set(k, url.searchParams.get(k)!);
      return json(await waline(env, "comment?" + query, walineSession.token));
    }
    if (route === "/api/comments/action" && request.method === "POST") {
      const data = await body(request);
      const id = Number(data.id);
      if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, "评论 ID 无效。");
      if (data.action === "delete") return json(await waline(env, "comment/" + id, walineSession.token, "DELETE"));
      if (data.action === "approve" || data.action === "spam") return json(await waline(env, "comment/" + id, walineSession.token, "PUT", { status: data.action === "approve" ? "approved" : "spam" }));
      if (data.action === "reply" && typeof data.text === "string" && data.text.trim() && typeof data.path === "string") return json(await waline(env, "comment", walineSession.token, "POST", { comment: data.text, url: data.path, pid: id, rid: Number(data.rid) || id }));
      throw new HttpError(400, "评论操作无效。");
    }
  }
  throw new HttpError(404, "接口不存在。");
}
const adminWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return await handle(request, env); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("Admin request failed:", error instanceof Error ? error.name : "Unknown");
      return json({ error: "后台请求失败，请稍后重试。" }, 500);
    }
  },
};
export default adminWorker;

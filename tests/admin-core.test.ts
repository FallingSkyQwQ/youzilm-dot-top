import test from "node:test";
import assert from "node:assert/strict";
import { GitHub } from "../admin/lib/github";
import { validateFile, parseDocument, serializeDocument } from "../admin/lib/content";
import { signSession, verifySession, authenticate, checkOrigin } from "../admin/lib/auth";
import worker from "../admin/worker";
import { HttpError, type Env } from "../admin/types";
import { readingProgress } from "../src/lib/reading-progress";
import { buildSearchRecords } from "../scripts/build-content.mjs";

const head = "a".repeat(40), nextHead = "b".repeat(40);
const env = { GITHUB_OWNER: "owner", GITHUB_REPO: "blog", GITHUB_TOKEN: "test-token", GITHUB_BRANCH: "main",
  ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "test-password-long", ADMIN_SESSION_SECRET: "test-session-secret-with-32-characters",
  ADMIN_LOGIN_LIMITER: { limit: async () => ({ success: true }) } } as Env;
const document = serializeDocument({ title: "中文标题", date: "2026-11-14", tags: ["notes"], draft: true }, "## 内容\n\n正文。");

test("GitHub rejects stale heads before creating any Git objects", async () => {
  const calls: string[] = [];
  const github = new GitHub(env, (async (_url, options) => { calls.push(options?.method || "GET"); return Response.json({ object: { sha: nextHead } }); }) as typeof fetch);
  await assert.rejects(() => github.save(head, [{ path: "content/posts/zh/test.md", content: document }], "save"), (e: unknown) => e instanceof HttpError && e.status === 409);
  assert.deepEqual(calls, ["GET"]);
});
test("GitHub rename creates one commit, preserves the base tree, and never force-pushes", async () => {
  const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
  const github = new GitHub(env, (async (url, options) => {
    const route = String(url), method = options?.method || "GET", body = options?.body ? JSON.parse(String(options.body)) : {};
    calls.push({ url: route, method, body });
    if (route.includes("/git/ref/")) return Response.json({ object: { sha: head } });
    if (method === "GET") return Response.json({ tree: { sha: "original-tree" } });
    if (route.endsWith("/git/trees")) return Response.json({ sha: "new-tree" });
    return Response.json({ sha: nextHead });
  }) as typeof fetch);
  const result = await github.save(head, [{ path: "content/posts/zh/new.md", content: document }, { path: "content/posts/zh/old.md", content: null }], "rename");
  assert.equal(result.head, nextHead);
  const tree = calls.find(c => c.url.endsWith("/git/trees"))!.body;
  assert.equal(tree.base_tree, "original-tree");
  assert.equal((tree.tree as { sha?: unknown }[])[1].sha, null);
  assert.deepEqual(calls.at(-1)!.body, { sha: nextHead, force: false });
  assert.equal(calls.filter(c => c.method === "POST" && c.url.endsWith("/git/commits")).length, 1);
});
test("unmanaged paths and invalid configuration never reach GitHub", async () => {
  let fetched = false;
  const github = new GitHub(env, (async () => { fetched = true; return Response.json({}); }) as typeof fetch);
  for (const path of [".env.local", "content/posts/zh/../../site.json", "public/images/evil.svg"]) {
    await assert.rejects(() => github.save(head, [{ path, content: "secret" }], "save"));
  }
  assert.equal(fetched, false);
  assert.throws(() => validateFile("content/posts/zh/test.md", serializeDocument({ title: "x", date: "2026-02-30" }, "text")));
  assert.throws(() => validateFile("content/ui.json", '{"zh":{"unexpected":"value"}}'));
  assert.throws(() => validateFile("content/ui.json", '{"zh":{"article":[]}}'));
  assert.deepEqual(parseDocument(document).data.tags, ["notes"]);
});
test("sessions reject tampering, expiration, and cross-origin mutations", async () => {
  const value = await signSession({ kind: "admin", csrf: "csrf", expires: Date.now() + 60000 }, env.ADMIN_SESSION_SECRET);
  assert.equal((await verifySession(value, env.ADMIN_SESSION_SECRET))?.csrf, "csrf");
  assert.equal(await verifySession(value + "x", env.ADMIN_SESSION_SECRET), null);
  const expired = await signSession({ kind: "admin", csrf: "csrf", expires: Date.now() - 1 }, env.ADMIN_SESSION_SECRET);
  assert.equal(await verifySession(expired, env.ADMIN_SESSION_SECRET), null);
  assert.throws(() => checkOrigin(new Request("https://admin.example.com/api/login", { method: "POST", headers: { origin: "https://evil.example" } })));
  await assert.rejects(() => authenticate(new Request("https://admin.example.com/api/save", { method: "POST", headers: { cookie: "blog_admin=" + value, origin: "https://admin.example.com", "x-csrf-token": "wrong" } }), env));
});
test("worker login requires the configured email and protects all content APIs", async () => {
  const login = (email: string) => worker.fetch(new Request("https://admin.example.com/api/login", { method: "POST", headers: { origin: "https://admin.example.com", "content-type": "application/json" }, body: JSON.stringify({ email, password: env.ADMIN_PASSWORD }) }), env);
  assert.equal((await login("other@example.com")).status, 401);
  const response = await login(env.ADMIN_EMAIL);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") || "", /HttpOnly; SameSite=Strict/);
  assert.match(response.headers.get("set-cookie") || "", /Secure/);
  assert.equal((await worker.fetch(new Request("https://admin.example.com/api/snapshot"), env)).status, 401);
  const throttled = { ...env, ADMIN_LOGIN_LIMITER: { limit: async () => ({ success: false }) } };
  const request = new Request("https://admin.example.com/api/login", { method: "POST", headers: { origin: "https://admin.example.com", "content-type": "application/json" }, body: "{}" });
  assert.equal((await worker.fetch(request, throttled)).status, 429);
});
test("reading progress measures body length, including the final section", () => {
  assert.equal(readingProgress(100, 2000, 800), 0);
  assert(readingProgress(-400, 2000, 800) < 1);
  assert.equal(readingProgress(-1296, 2000, 800), 1);
  assert.equal(readingProgress(-100, 300, 800), 1);
});
test("English search uses canonical Chinese tags with one record per article", () => {
  const zh = { lang: "zh", slug: "test", title: "测试", date: "2026-11-14", summary: "", tags: ["programming"], plain: "body" };
  const en = { ...zh, lang: "en", title: "Test", tags: ["notes"] };
  const records = buildSearchRecords([zh, en], []);
  assert.equal(records.length, 2);
  assert.deepEqual(records.find((r: { lang: string }) => r.lang === "en").tags, ["programming"]);
});

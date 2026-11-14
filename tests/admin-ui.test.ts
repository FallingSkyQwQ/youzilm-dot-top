import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const head = "a".repeat(40);
const snapshot = { head, files: {
  "content/site.json": { content: JSON.stringify({ name: { zh: "测试博客" }, tagline: { zh: "Hello" }, url: "https://example.com" }) },
  "content/tags.json": { content: "[]" }, "content/projects.json": { content: "[]" },
  "content/links.json": { content: '{"friends":[],"elsewhere":[]}' }, "content/ui.json": { content: '{"zh":{},"en":{}}' }
}, documents: {}, images: [], uiDefaults: { zh: [], en: [] } };
async function settle() { await new Promise(resolve => setTimeout(resolve, 25)); }
function setup(responseFor?: (route: string, data?: Record<string, unknown>) => unknown, initialSnapshot: object = snapshot) {
  const dom = new JSDOM(fs.readFileSync("admin/public/index.html", "utf8"), { url: "https://admin.example.com/", runScripts: "outside-only" });
  const { window } = dom;
  window.structuredClone = structuredClone;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const calls: { route: string; data?: Record<string, unknown> }[] = [];
  window.fetch = async (url: string, init: RequestInit) => {
    const route = String(url).replace("/api/", ""), data = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ route, data });
    const custom = await responseFor?.(route, data);
    if (custom) return custom;
    if (route === "session") return { ok: true, json: async () => ({ authenticated: true, csrf: "csrf", repository: "owner/repo", branch: "main" }) };
    if (route === "snapshot") return { ok: true, json: async () => structuredClone(initialSnapshot) };
    if (route === "preview") return { ok: true, json: async () => ({ html: "<p>Preview</p>" }) };
    if (route === "articles") return { ok: false, status: 409, json: async () => ({ error: "仓库已更新" }) };
    return { ok: true, json: async () => ({}) };
  };
  window.eval(fs.readFileSync("admin/public/app.js", "utf8"));
  return { dom, window, calls };
}
test("administrator can create, edit, and keep a draft after a save conflict", async () => {
  const { dom, window, calls } = setup();
  try {
    await settle();
    assert.equal(window.document.querySelector("#workspace")!.hasAttribute("hidden"), false);
    (window.document.querySelector('[data-action="new-article"]') as HTMLButtonElement).click();
    await settle();
    (window.document.querySelector('#modal-form [name="title"]') as HTMLInputElement).value = "测试文章";
    (window.document.querySelector('#modal-form [name="slug"]') as HTMLInputElement).value = "test-article";
    window.document.querySelector("#modal-form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    const textarea = window.document.querySelector("#markdown") as HTMLTextAreaElement;
    assert(textarea);
    textarea.value = "这是不能丢失的正文。";
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    (window.document.querySelector('[data-action="save-editor"]') as HTMLButtonElement).click();
    await settle();
    const save = calls.find(call => call.route === "articles")!;
    assert.equal(save.data?.baseSha, head);
    assert.equal((save.data?.versions as { zh: { body: string } }).zh.body, "这是不能丢失的正文。");
    assert.match(window.document.querySelector("#editor-state")!.textContent || "", /保存冲突/);
    const draft = JSON.parse(window.localStorage.getItem("blog-admin-draft:owner/repo:test-article")!);
    assert.equal(draft.versions.zh.body, "这是不能丢失的正文。");
    assert.equal((window.document.querySelector("#markdown") as HTMLTextAreaElement).value, "这是不能丢失的正文。");
    assert.equal(window.document.querySelector("#preview")!.getAttribute("sandbox"), "");
  } finally { dom.window.close(); }
});

async function createArticle(window: JSDOM["window"], slug: string) {
  (window.document.querySelector('[data-action="new-article"]') as HTMLButtonElement).click(); await settle();
  (window.document.querySelector('#modal-form [name="title"]') as HTMLInputElement).value = "测试文章";
  (window.document.querySelector('#modal-form [name="slug"]') as HTMLInputElement).value = slug;
  window.document.querySelector("#modal-form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await settle();
}
function typeBody(window: JSDOM["window"], value: string) {
  const textarea = window.document.querySelector("#markdown") as HTMLTextAreaElement;
  textarea.value = value;
  textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
}

test("brand links and browser navigation preserve the editor when leaving is cancelled", async () => {
  const { dom, window } = setup();
  try {
    await settle(); await createArticle(window, "navigation"); typeBody(window, "保留正文");
    (window.document.querySelector(".brand") as HTMLAnchorElement).click(); await settle();
    assert(window.document.querySelector("#modal")!.hasAttribute("open"));
    (window.document.querySelector('[data-action="close-modal"]') as HTMLButtonElement).click(); await settle();
    assert.equal((window.document.querySelector("#markdown") as HTMLTextAreaElement).value, "保留正文");
    window.location.hash = "pages"; await settle();
    assert(window.document.querySelector("#modal")!.hasAttribute("open"));
    (window.document.querySelector('[data-action="close-modal"]') as HTMLButtonElement).click(); await settle();
    assert.equal(window.location.hash, "");
    assert.equal((window.document.querySelector("#markdown") as HTMLTextAreaElement).value, "保留正文");
  } finally { dom.window.close(); }
});

test("typing during a successful save keeps new changes and advances the draft base SHA", async () => {
  let completeSave!: (value: object) => void;
  const response = new Promise(resolve => completeSave = resolve), nextHead = "b".repeat(40);
  const { dom, window, calls } = setup(route => route === "articles" ? response : undefined);
  try {
    await settle(); await createArticle(window, "in-flight"); typeBody(window, "提交的正文");
    (window.document.querySelector('[data-action="save-editor"]') as HTMLButtonElement).click(); await settle();
    typeBody(window, "保存期间的新正文");
    completeSave({ ok: true, json: async () => ({ head: nextHead, url: "https://github.com/owner/repo/commit/" + nextHead }) }); await settle();
    const save = calls.find(call => call.route === "articles")!;
    assert.equal((save.data?.versions as { zh: { body: string } }).zh.body, "提交的正文");
    assert.equal((window.document.querySelector("#markdown") as HTMLTextAreaElement).value, "保存期间的新正文");
    const draft = JSON.parse(window.localStorage.getItem("blog-admin-draft:owner/repo:in-flight")!);
    assert.equal(draft.versions.zh.body, "保存期间的新正文");
    assert.equal(draft.baseSha, nextHead);
    assert.equal(draft.isNew, false);
    assert.match(window.document.querySelector("#editor-state")!.textContent || "", /新修改/);
  } finally { dom.window.close(); }
});

test("page saves retain both languages and preview resolves images against the public blog", async () => {
  const doc = (body: string) => ({ data: { title: "About", date: "2026-11-14" }, body });
  const initial = { ...snapshot, documents: { "content/pages/zh/about.md": doc("中文"), "content/pages/en/about.md": doc("English") } };
  const { dom, window, calls } = setup(route => {
    if (route === "preview") return { ok: true, json: async () => ({ html: '<p><img src="/images/test.png"></p>' }) };
    if (route === "pages") return { ok: false, status: 409, json: async () => ({ error: "仓库已更新" }) };
  }, initial);
  try {
    await settle(); (window.document.querySelector('[data-section="pages"]') as HTMLAnchorElement).click(); await settle();
    (window.document.querySelector('[data-action="edit-page"][data-slug="about"][data-locale="zh"]') as HTMLButtonElement).click(); await settle();
    typeBody(window, "新中文");
    (window.document.querySelector('[data-action="editor-locale"][data-locale="en"]') as HTMLButtonElement).click(); await settle();
    typeBody(window, "New English");
    (window.document.querySelector('[data-action="save-editor"]') as HTMLButtonElement).click(); await settle();
    const save = calls.find(call => call.route === "pages")!;
    const versions = save.data?.versions as Record<string, { body: string }>;
    assert.equal(versions.zh.body, "新中文"); assert.equal(versions.en.body, "New English");
    const frame = window.document.querySelector("#preview") as HTMLIFrameElement;
    assert.equal(frame.getAttribute("sandbox"), "");
    assert.match(frame.srcdoc, /https:\/\/example.com\/images\/test.png/);
    assert.match(frame.srcdoc, /lang="en"/);
    assert(window.localStorage.getItem("blog-admin-draft:owner/repo:page-about"));
  } finally { dom.window.close(); }
});
test("switching language keeps both article bodies and inserts Markdown at the cursor", async () => {
  const { dom, window } = setup();
  try {
    await settle();
    (window.document.querySelector('[data-action="new-article"]') as HTMLButtonElement).click(); await settle();
    (window.document.querySelector('#modal-form [name="title"]') as HTMLInputElement).value = "双语";
    (window.document.querySelector('#modal-form [name="slug"]') as HTMLInputElement).value = "bilingual";
    window.document.querySelector("#modal-form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await settle();
    let textarea = window.document.querySelector("#markdown") as HTMLTextAreaElement;
    textarea.value = "中文正文"; textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    (window.document.querySelector('[data-action="editor-locale"][data-locale="en"]') as HTMLButtonElement).click(); await settle();
    textarea = window.document.querySelector("#markdown") as HTMLTextAreaElement;
    textarea.value = "English body"; textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    (window.document.querySelector('[data-action="editor-locale"][data-locale="zh"]') as HTMLButtonElement).click(); await settle();
    textarea = window.document.querySelector("#markdown") as HTMLTextAreaElement;
    assert.equal(textarea.value, "中文正文");
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    const snippets = window.document.querySelector("#snippet") as HTMLSelectElement;
    snippets.value = "heading"; snippets.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.match(textarea.value, /中文正文\n\n## 新章节/);
    const draft = JSON.parse(window.localStorage.getItem("blog-admin-draft:owner/repo:bilingual")!);
    assert.equal(draft.versions.en.body, "English body");
  } finally { dom.window.close(); }
});

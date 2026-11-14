
const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = value => structuredClone(value);
const names = { dashboard: "概览", articles: "文章", pages: "独立页面", tags: "标签", projects: "作品", links: "友链", media: "图片库", site: "站点信息", ui: "界面文案", comments: "评论", deployments: "发布记录", settings: "连接与设置" };
const state = { session: null, snapshot: null, editor: null, route: "dashboard", pending: {}, filter: "", commentPage: 1, comments: [], commentStatus: "", commentPath: "" };
let toastTimer, previewTimer, modalResolver, busy = false;
function toast(text) { const el = $("#toast"); el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 4200); }
async function api(route, data) {
  const response = await fetch("/api/" + route, { method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "x-csrf-token": state.session?.csrf || "" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "请求失败，请重试。"); error.status = response.status;
    if (response.status === 401 && !route.startsWith("comments") && !route.startsWith("login")) showLogin();
    throw error;
  }
  return result;
}
function field(label, name, value = "", type = "text", full = false) {
  const id = "field-" + name.replaceAll(".", "-");
  const input = type === "textarea" ? '<textarea id="' + id + '" name="' + esc(name) + '">' + esc(value) + '</textarea>' : '<input id="' + id + '" name="' + esc(name) + '" type="' + type + '" value="' + esc(value) + '">';
  return '<div class="field' + (full ? " full" : "") + '"><label for="' + id + '">' + esc(label) + '</label>' + input + '</div>';
}
function button(action, label, extra = "", style = "secondary") { return '<button type="button" class="' + style + '" data-action="' + action + '" ' + extra + '>' + esc(label) + '</button>'; }
function pageHead(title, description, actions = "") { return '<div class="page-head"><div><span class="eyebrow">YOUR BLOG, YOUR SPACE</span><h1>' + esc(title) + '</h1><p>' + esc(description) + '</p></div><div class="head-actions">' + actions + '</div></div>'; }
function badge(value) {
  const text = { published: "已发布", draft: "草稿", mixed: "部分草稿", approved: "已通过", waiting: "待审核", spam: "垃圾评论", completed: "已完成", in_progress: "进行中", queued: "排队中", success: "发布成功", failure: "发布失败", cancelled: "已取消" }[value] || value;
  return '<span class="badge ' + (["published", "approved", "success"].includes(value) ? "green" : ["draft", "waiting", "in_progress", "queued", "mixed"].includes(value) ? "amber" : ["failure", "spam"].includes(value) ? "red" : "") + '">' + esc(text) + '</span>';
}
function modal(title, html, confirmText = "确认", danger = false) {
  if (modalResolver) modalResolver(null);
  $("#modal-content").innerHTML = '<h2 id="modal-title">' + esc(title) + "</h2>" + html;
  $("#modal-submit").textContent = confirmText; $("#modal-submit").className = danger ? "danger" : "primary";
  $("#modal").showModal();
  return new Promise(resolve => modalResolver = resolve);
}
function closeModal(value = null) { $("#modal").close(); const resolve = modalResolver; modalResolver = null; resolve?.(value); }
$("#modal-form").addEventListener("submit", event => { event.preventDefault(); closeModal(Object.fromEntries(new FormData(event.currentTarget))); });
$("#modal").addEventListener("cancel", event => { event.preventDefault(); closeModal(); });
function getJson(path, fallback) { return state.pending[path] || JSON.parse(state.snapshot.files[path]?.content || JSON.stringify(fallback)); }
function groups() {
  const bySlug = new Map();
  for (const [path, doc] of Object.entries(state.snapshot.documents)) {
    const match = path.match(/^content\/posts\/(zh|en)\/([a-z0-9-]+)\.md$/);
    if (!match) continue;
    const group = bySlug.get(match[2]) || { slug: match[2], versions: {} };
    group.versions[match[1]] = doc; bySlug.set(match[2], group);
  }
  return [...bySlug.values()].map(group => {
    const primary = group.versions.zh || group.versions.en;
    const flags = Object.values(group.versions).map(doc => !!doc.data.draft);
    return { ...group, title: primary.data.title, date: primary.data.date, tags: primary.data.tags || [], status: flags.every(Boolean) ? "draft" : flags.every(x => !x) ? "published" : "mixed" };
  }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}
function draftKey(slug) { return "blog-admin-draft:" + state.session.repository + ":" + slug; }
function stashEditor() {
  if (!state.editor) return;
  try { localStorage.setItem(draftKey(state.editor.originalSlug), JSON.stringify(state.editor)); } catch { toast("本机草稿保存失败，请先保存或下载正文。"); }
}
function dirty() { return !!state.editor?.dirty || Object.keys(state.pending).length > 0; }
function showLogin() { stashEditor(); $("#workspace").hidden = true; $("#login").hidden = false; $("#password").focus(); }
async function loadSnapshot() {
  state.snapshot = await api("snapshot");
  $("#repo").textContent = state.session.repository + " · " + state.session.branch;
}
async function start() {
  try {
    state.session = await api("session");
    if (!state.session.authenticated) { showLogin(); if (!state.session.configured) $("#login-error").textContent = "后台尚未配置登录凭据，请先完成部署设置。"; return; }
    $("#login").hidden = true; $("#workspace").hidden = false;
    await loadSnapshot(); renderRoute();
  } catch (error) { $("#main").innerHTML = '<div class="empty"><h2>暂时无法读取博客</h2><p>' + esc(error.message) + '</p>' + button("reload", "重新连接") + '</div>'; }
}
$("#login-form").addEventListener("submit", async event => {
  event.preventDefault(); const submit = $("button", event.currentTarget); submit.disabled = true;
  try { await api("login", { email: $("#email").value, password: $("#password").value }); $("#password").value = ""; $("#login-error").textContent = ""; await start(); }
  catch (error) { $("#login-error").textContent = error.message; } finally { submit.disabled = false; }
});
function selectRoute(route) {
  state.route = route; state.filter = "";
  for (const link of document.querySelectorAll("[data-section]")) {
    if (link.dataset.section === route) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
  $("#breadcrumb").textContent = names[route] || "编辑内容";
}
function renderRoute() {
  if (!state.snapshot) return;
  stashEditor(); clearTimeout(previewTimer);
  const route = location.hash.slice(1) || "dashboard";
  selectRoute(names[route] ? route : "dashboard");
  state.editor = null;
  ({ dashboard: renderDashboard, articles: renderArticles, pages: renderPages, tags: renderTags, projects: renderProjects, links: renderLinks, media: renderMedia, site: renderSite, ui: renderUi, comments: renderComments, deployments: renderDeployments, settings: renderSettings }[state.route])();
}
async function navigate(route) {
  if (state.editor?.dirty && !await modal("离开编辑器？", "<p>修改尚未保存到 GitHub。本机草稿会保留，你可以稍后继续编辑。</p>", "保留草稿并离开")) return;
  stashEditor(); state.editor = null;
  if (location.hash === "#" + route) renderRoute(); else location.hash = route;
}
window.addEventListener("hashchange", async event => {
  const route = location.hash.slice(1) || "dashboard";
  if (!names[route]) return;
  if (state.editor) {
    history.replaceState(null, "", event.oldURL);
    if (busy) { toast("请等待当前操作完成。"); return; }
    await navigate(route);
  } else renderRoute();
});
window.addEventListener("beforeunload", event => { if (dirty()) { event.preventDefault(); event.returnValue = ""; } });
function articleTable(items) {
  if (!items.length) return '<div class="empty"><h2>从一个想法开始。</h2><p>这里还没有文章，创建第一篇吧。</p>' + button("new-article", "写一篇文章", "", "primary") + '</div>';
  return '<div class="table-wrap"><table><thead><tr><th>文章</th><th>语言</th><th>状态</th><th>日期</th><th></th></tr></thead><tbody>' + items.map(item => '<tr><td class="title-cell">' + button("edit-article", item.title, 'data-slug="' + esc(item.slug) + '"', "title-link") + '<small>' + esc(item.slug) + '</small></td><td>' + esc(Object.keys(item.versions).join(" / ")) + '</td><td>' + badge(item.status) + '</td><td>' + esc(item.date) + '</td><td>' + button("edit-article", "编辑", 'data-slug="' + esc(item.slug) + '"') + '</td></tr>').join("") + '</tbody></table></div>';
}
function renderDashboard() {
  const items = groups(), site = getJson("content/site.json", {});
  $("#main").innerHTML = pageHead("让想法继续生长。", "欢迎回来。今天想写点什么？", button("new-article", "＋ 新文章", "", "primary")) +
    '<div class="stats">' + [["全部文章", items.length], ["草稿", items.filter(x => x.status !== "published").length], ["标签", getJson("content/tags.json", []).length], ["作品", getJson("content/projects.json", []).length]].map(([label, value]) => '<div class="stat"><span>' + label + '</span><strong>' + value + '</strong></div>').join("") + '</div>' +
    '<div class="grid-two"><section><div class="card-head"><h2>最近的文章</h2><a href="#articles">查看全部 →</a></div>' + articleTable(items.slice(0, 5)) + '</section><section><div class="card"><h2>你的站点</h2><h3>' + esc(site.name?.zh || "博客") + '</h3><p class="muted">' + esc(site.tagline?.zh) + '</p><p><a target="_blank" rel="noopener" href="' + esc(safeUrl(site.url)) + '">访问博客 ↗</a></p><p class="code">版本 ' + esc(state.snapshot.head.slice(0, 8)) + '</p></div><div class="card"><h2>随手整理</h2><div class="list-row"><a href="#pages">更新「现在」页面</a><span>→</span></div><div class="list-row"><a href="#comments">看看读者的留言</a><span>→</span></div><div class="list-row"><a href="#deployments">查看最近发布</a><span>→</span></div></div></section></div>';
}
function safeUrl(value) { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; } }
function renderArticles() {
  const items = groups().filter(item => (item.title + " " + item.slug + " " + item.tags.join(" ")).toLowerCase().includes(state.filter.toLowerCase()) && (!state.articleStatus || item.status === state.articleStatus));
  $("#main").innerHTML = pageHead("文章", "中文与英文是同一篇文章的两个版本。", button("new-article", "＋ 新文章", "", "primary")) +
    '<div class="toolbar"><input type="search" id="article-search" placeholder="搜索标题、slug 或标签" aria-label="筛选文章" value="' + esc(state.filter) + '"><select id="article-status" aria-label="文章状态"><option value="">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option><option value="mixed">部分草稿</option></select><span class="muted">' + items.length + ' 篇文章</span></div>' + articleTable(items);
  $("#article-status").value = state.articleStatus || "";
}
async function openArticle(slug, isNew = false, initialTitle = "") {
  const group = groups().find(item => item.slug === slug);
  const versions = group ? clone(group.versions) : { zh: { data: { title: initialTitle || "新文章", date: new Date().toISOString().slice(0, 10), tags: [], draft: true }, body: "" } };
  let editor = { kind: "article", slug, originalSlug: slug, versions, locale: versions.zh ? "zh" : "en", isNew, dirty: false, baseSha: state.snapshot.head };
  try {
    const cached = JSON.parse(localStorage.getItem(draftKey(slug)) || "null");
    if (cached?.dirty && await modal("继续编辑本机草稿？", "<p>发现尚未保存的修改。若仓库内容已变化，请先对照新版本合并。</p>", "恢复草稿")) editor = cached;
  } catch { /* The server copy remains available when storage is blocked. */ }
  state.editor = editor; renderEditor();
}
function syncEditor() {
  const editor = state.editor, form = $("#editor-form");
  if (!editor || !form) return;
  const values = Object.fromEntries(new FormData(form)), doc = editor.versions[editor.locale];
  editor.slug = editor.kind === "article" ? String(values.slug).trim() : editor.slug;
  doc.data.title = values.title; doc.data.date = values.date || undefined; doc.data.summary = values.summary || "";
  if (values.updated) doc.data.updated = values.updated; else delete doc.data.updated;
  if (editor.kind === "article") {
    doc.data.draft = values.draft === "on";
    const tags = String(values.tags || "").split(",").map(t => t.trim()).filter(Boolean);
    for (const version of Object.values(editor.versions)) version.data.tags = tags;
  }
  doc.body = String(values.body || ""); editor.dirty = true; stashEditor();
  $("#editor-state").textContent = "未保存 · 本机草稿已更新";
}
function renderEditor() {
  const editor = state.editor, doc = editor.versions[editor.locale], isArticle = editor.kind === "article";
  $("#breadcrumb").textContent = (isArticle ? "文章" : "页面") + " / " + (doc.data.title || editor.slug);
  $("#main").innerHTML = pageHead(doc.data.title || "编辑内容", "保存修改后，博客会自动重新发布。", button("back-editor", "返回列表") + button("save-editor", "保存修改", "", "primary")) +
    '<div class="save-bar"><p id="editor-state">' + (editor.dirty ? "未保存 · 本机草稿已更新" : "已从 GitHub 载入") + '</p><div class="inline-actions">' + (isArticle ? button("publish-editor", "发布文章") + button("delete-article", "删除…", "", "danger") : "") + button("download-draft", "下载正文") + '</div></div>' +
    '<div class="tabs">' + ["zh", "en"].map(locale => button("editor-locale", (locale === "zh" ? "中文" : "English") + (editor.versions[locale] ? "" : " ＋"), 'data-locale="' + locale + '"', editor.locale === locale ? "active" : "")).join("") + '</div>' +
    '<form id="editor-form"><div class="card"><div class="fields">' +
    (isArticle ? field("文章 slug", "slug", editor.slug) : "") + field("标题", "title", doc.data.title) + field("日期", "date", doc.data.date || "", "date") + field("更新日期（可选）", "updated", doc.data.updated || "", "date") +
    (isArticle ? field("标签 key（逗号分隔）", "tags", (doc.data.tags || []).join(", ")) : "") + field("摘要", "summary", doc.data.summary || "", "textarea", true) +
    (isArticle ? '<label class="check"><input type="checkbox" name="draft" ' + (doc.data.draft ? "checked" : "") + '> 保存为草稿</label>' : "") + '</div></div>' +
    '<div class="editor-toolbar"><span class="muted">Markdown 正文</span><div class="inline-actions"><select id="snippet" aria-label="插入 Markdown 片段"><option value="">插入片段…</option><option value="heading">标题</option><option value="code">代码块</option><option value="table">表格</option><option value="image">图片</option><option value="quote">引用</option><option value="details">折叠内容</option><option value="math">公式</option><option value="footnote">脚注</option></select>' + button("preview", "刷新预览") + '</div></div>' +
    '<div class="editor-grid"><textarea id="markdown" class="editor" name="body" aria-label="Markdown 正文" spellcheck="false">' + esc(doc.body) + '</textarea><iframe id="preview" class="preview" title="正文预览" sandbox=""></iframe></div><div id="outline" class="outline"></div></form>';
  updateOutline(); refreshPreview();
}
function updateOutline() {
  const source = $("#markdown")?.value || "";
  const headings = [...source.matchAll(/^#{1,6}\s+(.+)$/gm)];
  $("#outline").innerHTML = headings.map(item => button("outline", item[1], 'data-offset="' + item.index + '"')).join("");
}
async function refreshPreview() {
  const source = $("#markdown")?.value, frame = $("#preview");
  if (source === undefined || !frame) return;
  try {
    const data = await api("preview", { markdown: source });
    if (!frame.isConnected || $("#markdown")?.value !== source) return;
    const preview = new DOMParser().parseFromString(data.html, "text/html"), site = getJson("content/site.json", {});
    for (const image of preview.querySelectorAll("img[src]")) {
      try { image.setAttribute("src", safeUrl(new URL(image.getAttribute("src"), site.url).href)); } catch { image.removeAttribute("src"); }
    }
    frame.srcdoc = '<!doctype html><html lang="' + (state.editor?.locale === "en" ? "en" : "zh-CN") + '"><head><meta charset="utf-8"><link rel="stylesheet" href="/preview.css"><link rel="stylesheet" href="/katex.css"></head><body>' + preview.body.innerHTML + '</body></html>';
  } catch (error) { toast(error.message); }
}
async function saveEditor(publish = false) {
  syncEditor(); const editor = state.editor;
  if (publish && !await modal("发布这篇文章？", "<p>现有语言版本都会发布。GitHub 保存成功后会自动构建博客。</p>", "发布文章")) return;
  if (publish) {
    for (const doc of Object.values(editor.versions)) doc.data.draft = false;
    $("#editor-form [name=draft]").checked = false; stashEditor();
  }
  const submitted = clone(editor), payload = { baseSha: editor.baseSha || state.snapshot.head, slug: submitted.slug, versions: submitted.versions };
  const saved = editor.kind === "article" ? await api("articles", { ...payload, originalSlug: submitted.originalSlug, isNew: submitted.isNew }) : await api("pages", payload);
  editor.baseSha = saved.head; editor.isNew = false;
  if (editor.kind === "article") editor.originalSlug = submitted.slug;
  state.snapshot.head = saved.head;
  try { await loadSnapshot(); } catch { toast("内容已保存，但最新列表读取失败。可稍后刷新内容。"); }
  editor.dirty = editor.slug !== submitted.slug || JSON.stringify(editor.versions) !== JSON.stringify(submitted.versions);
  try { localStorage.removeItem(draftKey(submitted.originalSlug)); } catch { /* Ignore unavailable storage. */ }
  if (editor.dirty) stashEditor();
  else toast("已保存到 GitHub，等待博客发布。");
  $("#editor-state").innerHTML = (editor.dirty ? "已保存先前修改 · 新修改仍保留为本机草稿" : "已保存") + ' · <a target="_blank" rel="noopener" href="' + esc(safeUrl(saved.url)) + '">查看提交 ↗</a>';
}
async function deleteArticle() {
  const editor = state.editor;
  if (editor.isNew) { await navigate("articles"); return; }
  const answer = await modal("删除文章版本", '<p>删除会记录为 GitHub 提交，可以通过仓库历史恢复。</p><div class="field"><label for="delete-language">删除范围</label><select name="lang" id="delete-language"><option value="both">全部语言版本</option>' + Object.keys(editor.versions).map(l => '<option value="' + l + '">' + l + '</option>').join("") + '</select></div>', "删除", true);
  if (!answer) return;
  const locales = answer.lang === "both" ? Object.keys(editor.versions) : [answer.lang];
  await api("save", { baseSha: state.snapshot.head, message: "content: delete article " + editor.originalSlug, changes: locales.map(locale => ({ path: "content/posts/" + locale + "/" + editor.originalSlug + ".md", content: null })) });
  editor.dirty = false;
  try { localStorage.removeItem(draftKey(editor.originalSlug)); } catch { /* Ignore storage failure. */ }
  await loadSnapshot(); await navigate("articles"); toast("文章版本已删除。");
}
function renderPages() {
  $("#main").innerHTML = pageHead("独立页面", "关于你，以及你此刻正在做的事。") + ["about", "now"].map(slug => '<div class="card"><div class="card-head"><div><h3>' + (slug === "about" ? "关于" : "现在") + '</h3><p class="muted">/' + slug + '</p></div><div class="inline-actions">' + ["zh", "en"].map(l => button("edit-page", (l === "zh" ? "中文" : "English") + (state.snapshot.documents["content/pages/" + l + "/" + slug + ".md"] ? " · 编辑" : " · 创建"), 'data-slug="' + slug + '" data-locale="' + l + '"')).join("") + '</div></div></div>').join("");
}
async function openPage(slug, locale) {
  const versions = {};
  for (const l of ["zh", "en"]) {
    const doc = state.snapshot.documents["content/pages/" + l + "/" + slug + ".md"];
    if (doc) versions[l] = clone(doc);
  }
  if (!versions[locale]) versions[locale] = { data: { title: slug === "about" ? (locale === "zh" ? "关于" : "About") : (locale === "zh" ? "现在" : "Now"), date: new Date().toISOString().slice(0, 10) }, body: versions.zh?.body || "" };
  let editor = { kind: "page", slug, originalSlug: "page-" + slug, versions, locale, dirty: false, baseSha: state.snapshot.head };
  try {
    const cached = JSON.parse(localStorage.getItem(draftKey(editor.originalSlug)) || "null");
    if (cached?.dirty && await modal("恢复页面草稿？", "<p>发现尚未保存的页面修改，请对照 GitHub 最新版本后再保存。</p>", "恢复草稿")) editor = cached;
  } catch { /* Fall back to the GitHub version. */ }
  state.editor = editor;
  renderEditor();
}
function pendingBar(path) { return '<div class="save-bar"><p>' + (state.pending[path] ? "有未保存的修改" : "内容已从 GitHub 载入") + '</p>' + button("save-config", "保存修改", 'data-path="' + path + '"', "primary") + '</div>'; }
function renderTags() {
  const tags = getJson("content/tags.json", []), articles = groups();
  $("#main").innerHTML = pageHead("标签", "名称可以改变，key 保持稳定。", button("add-item", "＋ 新标签", 'data-kind="tag"', "primary")) + pendingBar("content/tags.json") +
    '<div class="table-wrap"><table><thead><tr><th>Key</th><th>中文名称</th><th>英文名称</th><th>文章数</th><th></th></tr></thead><tbody>' + tags.map((tag, i) => '<tr><td class="code">' + esc(tag.key) + '</td><td>' + esc(tag.zh) + '</td><td>' + esc(tag.en) + '</td><td>' + articles.filter(a => a.tags.includes(tag.key)).length + '</td><td><div class="inline-actions">' + button("edit-item", "编辑", 'data-kind="tag" data-index="' + i + '"') + button("remove-item", "删除", 'data-kind="tag" data-index="' + i + '"', "link-button") + '</div></td></tr>').join("") + '</tbody></table></div>';
}
function renderProjects() {
  const projects = getJson("content/projects.json", []);
  $("#main").innerHTML = pageHead("作品", "给做过的事情一个位置。", button("add-item", "＋ 新作品", 'data-kind="project"', "primary")) + pendingBar("content/projects.json") +
    (projects.length ? projects.map((p, i) => '<div class="card"><div class="card-head"><h3>' + esc(p.title) + ' <span class="badge">' + esc(p.year) + '</span></h3><div class="inline-actions">' + button("move-item", "↑", 'data-kind="project" data-index="' + i + '" data-direction="-1" aria-label="上移作品"') + button("move-item", "↓", 'data-kind="project" data-index="' + i + '" data-direction="1" aria-label="下移作品"') + button("edit-item", "编辑", 'data-kind="project" data-index="' + i + '"') + button("remove-item", "删除", 'data-kind="project" data-index="' + i + '"', "link-button") + '</div></div><p class="muted">' + esc(p.description.zh) + '</p><p class="code">' + esc(p.tech.join(" · ")) + '</p></div>').join("") : '<div class="empty">还没有作品，添加一个吧。</div>');
}
function renderLinks() {
  const links = getJson("content/links.json", { friends: [], elsewhere: [] });
  $("#main").innerHTML = pageHead("友链", "朋友的网站，和你常去的地方。") + pendingBar("content/links.json") +
    ["friends", "elsewhere"].map(group => '<div class="card"><div class="card-head"><h2>' + (group === "friends" ? "朋友" : "常去的地方") + '</h2>' + button("add-item", "＋ 添加", 'data-kind="link" data-group="' + group + '"') + '</div>' + links[group].map((p, i) => '<div class="list-row"><div><strong>' + esc(p.name) + '</strong><small class="code"> · ' + esc(p.url) + '</small><p class="muted">' + esc(p.description.zh) + '</p></div><div class="inline-actions">' + button("edit-item", "编辑", 'data-kind="link" data-group="' + group + '" data-index="' + i + '"') + button("remove-item", "删除", 'data-kind="link" data-group="' + group + '" data-index="' + i + '"', "link-button") + '</div></div>').join("") + '</div>').join("");
}
function collection(kind, group) {
  const path = { tag: "content/tags.json", project: "content/projects.json", link: "content/links.json" }[kind];
  const root = clone(getJson(path, kind === "link" ? { friends: [], elsewhere: [] } : []));
  return { path, root, items: kind === "link" ? root[group] : root };
}
async function editItem(kind, group, index) {
  const { path, root, items } = collection(kind, group), item = index === undefined ? {} : items[index];
  let html;
  if (kind === "tag") html = field("稳定的 key", "key", item.key) + field("中文名称", "zh", item.zh) + field("英文名称", "en", item.en);
  else if (kind === "project") html = field("Slug", "slug", item.slug) + field("名称", "title", item.title) + field("年份", "year", item.year || new Date().getFullYear()) + field("中文介绍", "zh", item.description?.zh, "textarea") + field("英文介绍", "en", item.description?.en, "textarea") + field("技术栈（逗号分隔）", "tech", item.tech?.join(", ")) + field("链接（每行：名称 | URL）", "links", item.links?.map(l => l.label + " | " + l.url).join("\n"), "textarea");
  else html = field("站点名称", "name", item.name) + field("网址", "url", item.url, "url") + field("中文介绍", "zh", item.description?.zh, "textarea") + field("英文介绍", "en", item.description?.en, "textarea");
  const result = await modal(index === undefined ? "添加" : "编辑", html, "应用修改");
  if (!result) return;
  if (kind === "tag" && index !== undefined && result.key !== item.key) { toast("已有标签的 key 不能更改。"); return; }
  const data = kind === "tag" ? result : kind === "project" ? { slug: result.slug, title: result.title, year: result.year, description: { zh: result.zh, en: result.en }, tech: result.tech.split(",").map(t => t.trim()).filter(Boolean), links: result.links.split("\n").filter(l => l.trim()).map(l => { const [label, url] = l.split("|"); return { label: label?.trim(), url: url?.trim() }; }) } : { name: result.name, url: result.url, description: { zh: result.zh, en: result.en } };
  if (index === undefined) items.push(data); else items[index] = data;
  state.pending[path] = root; renderRoute();
}
async function removeItem(kind, group, index) {
  const { path, root, items } = collection(kind, group);
  if (kind === "tag" && groups().some(a => a.tags.includes(items[index].key))) { toast("这个标签仍被文章使用，请先移除文章标签。"); return; }
  if (!await modal("移除这个条目？", "<p>点击保存修改后才会提交到 GitHub。</p>", "移除", true)) return;
  items.splice(index, 1); state.pending[path] = root; renderRoute();
}
function renderSite() {
  const site = getJson("content/site.json", {});
  const labels = { name: "站点名称", author: "作者", tagline: "标语", description: "站点描述", bio: "个人简介", now: "现在的近况", url: "博客网址", github: "GitHub", x: "X", walineUrl: "评论服务网址", license: "内容许可证", licenseUrl: "许可证网址", startYear: "起始年份" };
  $("#main").innerHTML = pageHead("站点信息", "名字、介绍与联系方式。") + pendingBar("content/site.json") + '<form id="site-form"><div class="card"><div class="fields">' + Object.entries(site).map(([key, value]) => typeof value === "object" ? ["zh", "en"].map(l => field((labels[key] || key) + (l === "zh" ? " · 中文" : " · English"), key + "." + l, value[l], ["description", "bio", "now"].includes(key) ? "textarea" : "text")).join("") : field(labels[key] || key, key, value, typeof value === "number" ? "number" : "text")).join("") + '</div></div></form>';
}
function setPath(object, path, value) { const parts = path.split("."); let node = object; for (const part of parts.slice(0, -1)) node = node[part] ||= {}; node[parts.at(-1)] = value; }
function getPath(object, path) { return path.split(".").reduce((node, key) => node?.[key], object); }
function deletePath(object, path) { const parts = path.split("."); let node = object; for (const part of parts.slice(0, -1)) { node = node?.[part]; if (!node) return; } delete node[parts.at(-1)]; }
function renderUi() {
  const overrides = getJson("content/ui.json", { zh: {}, en: {} }), locale = state.uiLocale || "zh";
  const entries = state.snapshot.uiDefaults[locale].filter(row => (row.key + " " + row.value).toLowerCase().includes(state.filter.toLowerCase()));
  $("#main").innerHTML = pageHead("界面文案", "用自己的声音写导航、按钮和提示。留空会恢复默认文案。") + pendingBar("content/ui.json") + '<div class="toolbar"><select id="ui-locale" aria-label="文案语言"><option value="zh">中文</option><option value="en">English</option></select><input id="ui-search" type="search" placeholder="筛选 key 或文案" aria-label="筛选文案" value="' + esc(state.filter) + '"></div><div class="card">' + entries.map(row => '<div class="ui-row"><div><label for="ui-' + esc(row.key) + '">' + esc(row.key) + '</label><small>默认：' + esc(row.value) + '</small></div><textarea id="ui-' + esc(row.key) + '" data-ui-key="' + esc(row.key) + '" aria-label="' + esc(row.key) + '">' + esc(getPath(overrides[locale], row.key) ?? "") + '</textarea>' + button("reset-ui", "恢复默认", 'data-key="' + esc(row.key) + '"', "link-button") + '</div>').join("") + '</div>';
  $("#ui-locale").value = locale;
}
async function saveConfig(path) {
  if (path === "content/site.json") {
    const data = clone(getJson(path, {}));
    for (const [key, value] of new FormData($("#site-form"))) setPath(data, key, key === "startYear" ? Number(value) : value);
    state.pending[path] = data;
  }
  if (!state.pending[path]) { toast("没有需要保存的修改。"); return; }
  const submitted = JSON.stringify(state.pending[path]);
  const saved = await api("save", { baseSha: state.snapshot.head, message: "content: update " + path, changes: [{ path, content: JSON.stringify(state.pending[path], null, 2) + "\n" }] });
  state.snapshot.head = saved.head;
  try { await loadSnapshot(); } catch { toast("配置已保存，但最新列表读取失败。可稍后刷新内容。"); }
  if (JSON.stringify(state.pending[path]) === submitted) delete state.pending[path];
  renderRoute(); toast(state.pending[path] ? "先前修改已保存，新修改尚未保存。" : "修改已保存，等待博客发布。");
}
function renderMedia() {
  const site = getJson("content/site.json", {}), images = state.snapshot.images;
  $("#main").innerHTML = pageHead("图片库", "上传图片，然后复制 Markdown 到正文。", button("upload-image", "＋ 上传图片", "", "primary")) +
    '<p class="help">支持 PNG、JPEG、WebP、GIF、AVIF，单张最多 5 MB。</p><input id="image-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden>' +
    (images.length ? '<div class="image-list">' + images.map(image => '<div class="card image-card"><img alt="' + esc(image.path.split("/").at(-1)) + '" src="' + esc(safeUrl((site.url || "").replace(/\/$/, "") + "/" + image.path.replace(/^public\//, ""))) + '" loading="lazy"><p>' + esc(image.path.split("/").at(-1)) + '</p><div class="inline-actions">' + button("copy-image", "复制 Markdown", 'data-path="' + esc(image.path) + '"') + button("delete-image", "删除", 'data-path="' + esc(image.path) + '"', "link-button") + '</div></div>').join("") + '</div>' : '<div class="empty">还没有图片。上传第一张吧。</div>');
}
async function uploadImage(file) {
  if (!file || file.size > 5 * 1024 * 1024 || !/\.(png|jpe?g|webp|gif|avif)$/i.test(file.name)) throw new Error("请选择 5 MB 以内的支持格式图片。");
  const extension = file.name.split(".").at(-1).toLowerCase(), name = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/^-+|-+$/g, "") || "image";
  const path = "public/images/" + name + "-" + Date.now() + "." + extension;
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  await api("save", { baseSha: state.snapshot.head, message: "content: upload " + name, changes: [{ path, content: btoa(binary), encoding: "base64" }] });
  await loadSnapshot(); renderMedia(); toast("图片已保存，博客发布后即可使用。");
}
async function renderComments() {
  $("#main").innerHTML = pageHead("评论", "读者的声音，值得好好回应。") + '<div class="loading">正在载入评论…</div>';
  try {
    const params = new URLSearchParams({ page: state.commentPage, status: state.commentStatus, path: state.commentPath });
    const result = await api("comments?" + params); if (state.route !== "comments") return;
    state.comments = result.data.data;
    $("#main").innerHTML = pageHead("评论", "审核、回复与整理留言。") +
      '<div class="toolbar"><select id="comment-status" aria-label="评论状态"><option value="">全部评论</option><option value="waiting">待审核</option><option value="approved">已通过</option><option value="spam">垃圾评论</option></select><input id="comment-path" type="search" placeholder="按页面路径筛选，如 /guestbook" aria-label="评论页面路径" value="' + esc(state.commentPath) + '">' + button("filter-comments", "筛选") + '</div>' +
      (state.comments.length ? state.comments.map(row => '<article class="card comment"><div class="card-head"><strong>' + esc(row.nick) + '</strong>' + badge(row.status) + '</div><p class="comment-meta">#' + row.objectId + ' · ' + esc(row.url) + ' · ' + esc(row.insertedAt) + '</p><div class="comment-content">' + esc(row.orig || row.comment) + '</div><div class="inline-actions">' + button("comment-action", "通过", 'data-op="approve" data-id="' + row.objectId + '"') + button("comment-action", "回复", 'data-op="reply" data-id="' + row.objectId + '"') + button("comment-action", "标记垃圾", 'data-op="spam" data-id="' + row.objectId + '"') + button("comment-action", "删除", 'data-op="delete" data-id="' + row.objectId + '"', "danger") + '</div></article>').join("") : '<div class="empty">这个筛选条件下没有评论。</div>') +
      '<div class="toolbar">' + button("comment-page", "上一页", 'data-page="' + Math.max(1, state.commentPage - 1) + '"') + '<span>' + state.commentPage + ' / ' + Math.max(1, result.data.totalPages) + '</span>' + button("comment-page", "下一页", 'data-page="' + Math.min(Math.max(1, result.data.totalPages), state.commentPage + 1) + '"') + '</div>';
    $("#comment-status").value = state.commentStatus;
  } catch (error) {
    if (state.route !== "comments") return;
    if (error.status !== 401) {
      $("#main").innerHTML = pageHead("评论", "暂时无法读取评论。") + '<div class="card"><p class="error">' + esc(error.message) + '</p>' + button("retry-comments", "重新加载") + '</div>';
      return;
    }
    $("#main").innerHTML = pageHead("评论", "使用现有 Waline 管理员账号连接评论服务。") +
      '<form id="comment-login" class="card"><p class="muted">' + esc(error.message) + '</p>' + field("管理员邮箱", "email", "", "email") + field("密码", "password", "", "password") + field("二步验证码（如已开启）", "code") + '<button class="primary" type="submit">连接评论服务</button></form>';
  }
}
async function commentAction(id, action) {
  const row = state.comments.find(c => c.objectId === id);
  const data = { id, action };
  if (action === "delete" && !await modal("删除这条评论？", "<p>这会永久删除评论及其回复。</p>", "删除评论", true)) return;
  if (action === "reply") {
    const answer = await modal("回复 " + row.nick, field("回复正文", "text", "", "textarea"), "发送回复");
    if (!answer || !answer.text.trim()) return;
    Object.assign(data, { text: answer.text, path: row.url, rid: row.rid || row.objectId });
  }
  await api("comments/action", data); toast("评论操作已完成。"); await renderComments();
}
async function renderDeployments() {
  $("#main").innerHTML = pageHead("发布记录", "每一次保存，都让博客向前一步。", button("deploy", "重新发布", "", "primary")) + '<div class="loading">正在读取发布记录…</div>';
  try {
    const data = await api("deployments"); if (state.route !== "deployments") return;
    $("#main").innerHTML = pageHead("发布记录", "保存成功与发布成功是两个阶段，可在这里查看构建结果。", button("deploy", "重新发布", "", "primary")) +
      (data.workflow_runs.length ? '<div class="card">' + data.workflow_runs.map(run => '<div class="list-row"><div><strong>' + esc(run.display_title || run.name) + '</strong><p class="comment-meta">' + esc(run.head_sha?.slice(0, 8)) + ' · ' + esc(new Date(run.created_at).toLocaleString()) + '</p></div><div class="inline-actions">' + badge(run.conclusion || run.status) + '<a target="_blank" rel="noopener" href="' + esc(safeUrl(run.html_url)) + '">查看日志 ↗</a></div></div>').join("") + '</div>' : '<div class="empty">还没有发布记录。确认仓库中已安装发布工作流。</div>');
  } catch (error) { if (state.route === "deployments") $("#main").innerHTML += '<p class="error">' + esc(error.message) + '</p>'; }
}
function renderSettings() {
  $("#main").innerHTML = pageHead("连接与设置", "内容保存在你的 GitHub 仓库中。") +
    '<div class="card"><h2>GitHub 连接</h2><div class="list-row"><span>仓库</span><span class="code">' + esc(state.session.repository) + '</span></div><div class="list-row"><span>分支</span><span class="code">' + esc(state.session.branch) + '</span></div><div class="list-row"><span>当前版本</span><span class="code">' + esc(state.snapshot.head) + '</span></div></div>' +
    '<div class="card"><h2>编辑与保存</h2><p>文章支持 Markdown、中文和英文版本、草稿与发布状态。保存产生 GitHub 提交，可在仓库历史中找回旧版本。</p><p>Ctrl / Cmd + S 保存当前编辑器；本机草稿仅保存在当前浏览器。关闭前请保存重要修改。</p><p>需要修改仓库、登录密码或评论服务连接时，请在 Cloudflare Worker 中更新配置。</p><a href="#deployments">查看发布记录 →</a></div>';
}
const snippets = { heading: "\n\n## 新章节\n\n", code: "\n\n```text\n代码\n```\n\n", table: "\n\n| 标题 | 内容 |\n| --- | --- |\n| 示例 | 示例 |\n\n", image: "\n\n![图片说明](/images/example.png \"图注\")\n\n", quote: "\n\n> 引用内容\n\n", details: "\n\n<details>\n<summary>展开阅读</summary>\n\n内容\n\n</details>\n\n", math: "\n\n$$\na^2 + b^2 = c^2\n$$\n\n", footnote: "文字[^1]\n\n[^1]: 脚注内容\n" };
document.addEventListener("input", event => {
  if (event.target.closest("#editor-form")) { syncEditor(); if (event.target.id === "markdown") { updateOutline(); clearTimeout(previewTimer); previewTimer = setTimeout(refreshPreview, 600); } }
  if (event.target.closest("#site-form")) { const data = clone(getJson("content/site.json", {})); for (const [key, value] of new FormData($("#site-form"))) setPath(data, key, key === "startYear" ? Number(value) : value); state.pending["content/site.json"] = data; }
  if (event.target.dataset.uiKey) { const data = clone(getJson("content/ui.json", { zh: {}, en: {} })), l = state.uiLocale || "zh"; data[l] ||= {}; if (event.target.value) setPath(data[l], event.target.dataset.uiKey, event.target.value); else deletePath(data[l], event.target.dataset.uiKey); state.pending["content/ui.json"] = data; }
  if (event.target.id === "article-search" || event.target.id === "ui-search") {
    const id = event.target.id, cursor = event.target.selectionStart; state.filter = event.target.value;
    if (id === "article-search") renderArticles(); else renderUi();
    $("#" + id).focus(); $("#" + id).setSelectionRange(cursor, cursor);
  }
});
document.addEventListener("change", async event => {
  if (event.target.id === "article-status") { state.articleStatus = event.target.value; renderArticles(); }
  if (event.target.id === "ui-locale") { state.uiLocale = event.target.value; renderUi(); }
  if (event.target.id === "snippet" && snippets[event.target.value]) {
    const area = $("#markdown"); area.setRangeText(snippets[event.target.value], area.selectionStart, area.selectionEnd, "end"); area.focus(); syncEditor(); updateOutline(); refreshPreview(); event.target.value = "";
  }
  if (event.target.id === "image-upload") { try { await uploadImage(event.target.files[0]); } catch (error) { toast(error.message); } }
});
document.addEventListener("submit", async event => {
  if (event.target.id === "editor-form") event.preventDefault();
  if (event.target.id === "comment-login") {
    event.preventDefault();
    try { await api("comments/login", Object.fromEntries(new FormData(event.target))); await renderComments(); } catch (error) { toast(error.message); }
  }
});
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && state.editor && !event.isComposing) {
    event.preventDefault(); $('[data-action="save-editor"]').click();
  }
});
document.addEventListener("click", async event => {
  const nav = event.target.closest('a[href^="#"]');
  const route = nav?.getAttribute("href").slice(1);
  if (nav && names[route]) { event.preventDefault(); if (!busy) await navigate(route); return; }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "close-modal") { closeModal(); return; }
  if (busy) return;
  busy = true; target.disabled = true;
  try {
    const d = target.dataset;
    if (action === "logout") { if (!dirty() || await modal("退出登录？", "<p>未保存的文章修改会保留为本机草稿。</p>", "退出")) { stashEditor(); await api("logout", {}); state.pending = {}; state.editor = null; showLogin(); } }
    else if (action === "reload") { if (!dirty() || await modal("刷新内容？", "<p>文章的本机草稿会保留；尚未保存的站点配置将被丢弃。</p>", "刷新")) { stashEditor(); state.pending = {}; await loadSnapshot(); renderRoute(); toast("已载入最新内容。"); } }
    else if (action === "new-article") { const answer = await modal("写一篇新文章", field("标题", "title") + field("Slug（小写字母、数字、连字符）", "slug"), "开始写作"); if (answer) { if (!/^[a-z0-9][a-z0-9-]*$/.test(answer.slug) || !answer.title.trim()) throw new Error("请填写标题和有效 slug。"); if (groups().some(g => g.slug === answer.slug)) throw new Error("这个 slug 已经存在。"); await openArticle(answer.slug, true, answer.title); } }
    else if (action === "edit-article") await openArticle(d.slug);
    else if (action === "back-editor") await navigate(state.editor.kind === "article" ? "articles" : "pages");
    else if (action === "save-editor") await saveEditor();
    else if (action === "publish-editor") await saveEditor(true);
    else if (action === "delete-article") await deleteArticle();
    else if (action === "editor-locale") { syncEditor(); const editor = state.editor; if (!editor.versions[d.locale]) { const source = clone(editor.versions[editor.locale]); source.data.draft = true; editor.versions[d.locale] = source; } editor.locale = d.locale; editor.dirty = true; stashEditor(); renderEditor(); }
    else if (action === "edit-page") await openPage(d.slug, d.locale);
    else if (action === "preview") await refreshPreview();
    else if (action === "outline") { $("#markdown").focus(); $("#markdown").setSelectionRange(Number(d.offset), Number(d.offset)); }
    else if (action === "download-draft") { syncEditor(); const blob = new Blob([state.editor.versions[state.editor.locale].body], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = state.editor.slug + "-" + state.editor.locale + ".md"; a.click(); URL.revokeObjectURL(url); }
    else if (action === "add-item" || action === "edit-item") await editItem(d.kind, d.group, action === "edit-item" ? Number(d.index) : undefined);
    else if (action === "remove-item") await removeItem(d.kind, d.group, Number(d.index));
    else if (action === "move-item") { const data = collection(d.kind, d.group), index = Number(d.index), next = index + Number(d.direction); if (next >= 0 && next < data.items.length) { [data.items[index], data.items[next]] = [data.items[next], data.items[index]]; state.pending[data.path] = data.root; renderRoute(); } }
    else if (action === "save-config") await saveConfig(d.path);
    else if (action === "reset-ui") { const data = clone(getJson("content/ui.json", { zh: {}, en: {} })); deletePath(data[state.uiLocale || "zh"], d.key); state.pending["content/ui.json"] = data; renderUi(); }
    else if (action === "upload-image") $("#image-upload").click();
    else if (action === "copy-image") { const markdown = "![" + d.path.split("/").at(-1) + "](/" + d.path.replace(/^public\//, "") + ")"; await navigator.clipboard.writeText(markdown); toast("Markdown 已复制。"); }
    else if (action === "delete-image") { if (await modal("删除图片？", "<p>请确认文章正文中已不再使用这张图片。</p>", "删除图片", true)) { await api("save", { baseSha: state.snapshot.head, message: "content: delete image", changes: [{ path: d.path, content: null }] }); await loadSnapshot(); renderMedia(); } }
    else if (action === "filter-comments") { state.commentStatus = $("#comment-status").value; state.commentPath = $("#comment-path").value.trim(); state.commentPage = 1; await renderComments(); }
    else if (action === "retry-comments") await renderComments();
    else if (action === "comment-page") { state.commentPage = Number(d.page); await renderComments(); }
    else if (action === "comment-action") await commentAction(Number(d.id), d.op);
    else if (action === "deploy") { if (await modal("重新发布博客？", "<p>将使用 GitHub 仓库当前保存的内容构建并发布。</p>", "开始发布")) { await api("deploy", {}); toast("发布任务已触发。"); await renderDeployments(); } }
  } catch (error) { toast(error.message); if (error.status === 409 && state.editor) { stashEditor(); $("#editor-state").textContent = "保存冲突：请下载草稿，刷新后对照最新内容合并。"; } }
  finally { busy = false; target.disabled = false; }
});
start();

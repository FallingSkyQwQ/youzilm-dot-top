#!/usr/bin/env node
/**
 * blog — a small CLI for this site.
 *
 *   npm run blog-cli -- list
 *   npm run blog-cli -- new
 *   npm run blog-cli -- edit hello-world
 *   npm run blog-cli -- page about
 *   npm run blog-cli -- text set tagline.zh "写代码，也写字。"
 *   npm run blog-cli -- comment list
 *   npm run blog-cli -- deploy
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import matter from "gray-matter";

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, "content");
const POSTS = path.join(CONTENT, "posts");
const PAGES = path.join(CONTENT, "pages");
const TAGS_FILE = path.join(CONTENT, "tags.json");
const SITE_FILE = path.join(CONTENT, "site.json");
const WRANGLER = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const BOOLEAN_FLAGS = new Set(["draft", "yes", "no-edit", "local", "json", "help", "drafts"]);

for (const file of [".env.local", ".env"]) {
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(path.join(ROOT, file));
    } catch {
      // No local env file; wrangler may still be logged in.
    }
  }
}

function parseArgs(argv) {
  let command = null;
  const positionals = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h") {
      flags.help = true;
      continue;
    }
    if (arg === "-y") {
      flags.yes = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=", 2);
      if (inline !== undefined) {
        flags[key] = inline;
        continue;
      }
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (!command) command = arg;
    else positionals.push(arg);
  }

  return { command, positionals, flags };
}

const { command, positionals, flags } = parseArgs(process.argv.slice(2));

let rl = null;
function getRl() {
  if (!rl) rl = createInterface({ input: stdin, output: stdout });
  return rl;
}
async function ask(question, fallback = "") {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await getRl().question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}
function closeRl() {
  if (rl) {
    rl.close();
    rl = null;
  }
}
async function confirm(question, defaultYes = false) {
  if (!stdin.isTTY && !flags.yes) {
    throw new Error("Refusing to continue without confirmation. Pass --yes.");
  }
  if (flags.yes) return true;
  const answer = (await ask(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"}`, defaultYes ? "y" : "n")).toLowerCase();
  return answer.startsWith("y");
}

function today() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return null;
}

function yamlString(value) {
  return `"${String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replace(/\r?\n/g, " ")}"`;
}

function frontmatter({ title, date, summary, tags, draft }) {
  const lines = ["---", `title: ${yamlString(title)}`, `date: ${date}`];
  if (summary) lines.push(`summary: ${yamlString(summary)}`);
  if (tags && tags.length) lines.push(`tags: [${tags.join(", ")}]`);
  if (draft) lines.push("draft: true");
  lines.push("---", "");
  return lines.join("\n");
}

function validateSlug(slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error("Slug must use lowercase letters, numbers, and hyphens (e.g. my-post).");
  }
}

function validateLang(lang) {
  if (lang !== "zh" && lang !== "en") {
    throw new Error(`Unknown language "${lang}". Use zh or en.`);
  }
  return lang;
}

function suggestSlug(title) {
  const base = String(title)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `post-${today().replaceAll("-", "")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listPostFiles(lang) {
  const langs = lang ? [lang] : ["zh", "en"];
  const files = [];
  for (const current of langs) {
    const dir = path.join(POSTS, current);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".md")) continue;
      files.push({ file: path.join(dir, name), lang: current });
    }
  }
  return files;
}

function parsePost(file, lang) {
  const parsed = matter(fs.readFileSync(file, "utf8"));
  const purelyText = parsed.content.replace(/```[\s\S]*?```/g, " ").replace(/<[^>]+>/g, " ");
  return {
    file,
    lang,
    slug: path.basename(file, ".md"),
    title: String(parsed.data.title || ""),
    date: normalizeDate(parsed.data.date) || "",
    summary: String(parsed.data.summary || ""),
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
    draft: parsed.data.draft === true,
    characters: purelyText.replace(/\s+/g, "").length,
  };
}

async function resolvePost(slug, lang) {
  const candidates = ["zh", "en"].filter((candidate) =>
    fs.existsSync(path.join(POSTS, candidate, `${slug}.md`)),
  );
  if (candidates.length === 0) throw new Error(`No post found for slug "${slug}".`);
  if (lang) {
    validateLang(lang);
    if (!candidates.includes(lang)) throw new Error(`No ${lang} post found for "${slug}".`);
    return { file: path.join(POSTS, lang, `${slug}.md`), lang };
  }
  if (candidates.length === 1) {
    return { file: path.join(POSTS, candidates[0], `${slug}.md`), lang: candidates[0] };
  }
  if (stdin.isTTY) {
    const answer = validateLang(
      await ask(`"${slug}" has zh and en versions. Which language?`, "zh"),
    );
    return { file: path.join(POSTS, answer, `${slug}.md`), lang: answer };
  }
  throw new Error(`"${slug}" exists in both zh and en. Pass --lang zh or --lang en.`);
}

/**
 * zh + en files with the same slug are two versions of one article.
 * The list, draft/publish, and delete commands operate on the group.
 */
function groupPosts(lang) {
  const groups = new Map();
  for (const item of listPostFiles(lang)) {
    const post = parsePost(item.file, item.lang);
    const group = groups.get(post.slug) || { slug: post.slug, versions: {} };
    group.versions[post.lang] = post;
    groups.set(post.slug, group);
  }
  return [...groups.values()];
}

function getGroup(slug) {
  const versions = {};
  for (const lang of ["zh", "en"]) {
    const file = path.join(POSTS, lang, `${slug}.md`);
    if (fs.existsSync(file)) versions[lang] = parsePost(file, lang);
  }
  return Object.keys(versions).length > 0 ? { slug, versions } : null;
}

function groupLanguages(group) {
  return ["zh", "en"].filter((lang) => group.versions[lang]);
}

function groupPrimary(group) {
  return group.versions.zh || group.versions.en;
}

function groupState(group) {
  const states = Object.values(group.versions).map((post) =>
    post.draft ? "draft" : "published",
  );
  if (states.every((state) => state === "published")) return "published";
  if (states.every((state) => state === "draft")) return "draft";
  return "mixed";
}

function selectedVersions(group, lang) {
  if (lang) {
    validateLang(lang);
    if (!group.versions[lang]) {
      throw new Error(`No ${lang} version found for "${group.slug}".`);
    }
    return [group.versions[lang]];
  }
  return Object.values(group.versions);
}

function editorCommand(file) {
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (editor) {
    const result = spawnSync(editor, [file], { cwd: ROOT, stdio: "inherit", shell: true });
    return result.status ?? 0;
  }
  if (process.platform === "win32") {
    const result = spawnSync("cmd", ["/c", "start", "", "/wait", "notepad", file], {
      cwd: ROOT,
      stdio: "inherit",
    });
    return result.status ?? 0;
  }
  if (process.platform === "darwin") {
    const result = spawnSync("open", ["-W", "-t", file], { cwd: ROOT, stdio: "inherit" });
    return result.status ?? 0;
  }
  const result = spawnSync("vi", [file], { cwd: ROOT, stdio: "inherit" });
  return result.status ?? 0;
}

function openEditor(file) {
  console.log(`\nOpening ${path.relative(ROOT, file)} ...`);
  const status = editorCommand(file);
  if (status !== 0) console.warn("The editor exited with a non-zero status.");
}

function rebuildContent() {
  const result = spawnSync(process.execPath, ["scripts/build-content.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.warn("Content rebuild failed. Run `npm run content` to see the error.");
  }
}

function displayWidth(value) {
  let width = 0;
  for (const char of String(value)) {
    width += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/.test(
      char,
    )
      ? 2
      : 1;
  }
  return width;
}

function padCell(value, width) {
  const text = String(value ?? "");
  const missing = Math.max(0, width - displayWidth(text));
  return text + " ".repeat(missing);
}

function printTable(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(displayWidth(header), ...rows.map((row) => displayWidth(row[index] ?? ""))),
  );
  const line = (cells) => cells.map((cell, index) => padCell(cell, widths[index])).join("  ");
  console.log(line(headers));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(line(row));
}

function usage() {
  console.log(`blog — manage 柚子的blog

Usage:
  npm run blog-cli -- <command> [options]

Articles (zh + en with the same slug are ONE article):
  list [--lang zh|en] [--drafts]
  new [--title ...] [--slug ...] [--lang zh|en] [--tags a,b]
      [--summary ...] [--date YYYY-MM-DD] [--draft] [--no-edit]
  edit <slug> [--lang zh|en]
  delete <slug> [--lang zh|en] [--yes]      # both versions by default
  draft <slug> [--lang zh|en]               # both versions by default
  publish <slug> [--lang zh|en]             # both versions by default
  translate <slug> [--title ...] [--summary ...] [--no-edit]
  page <about|now> [--lang zh|en]

Page text (content/site.json):
  text get [key]
  text set <key> <value>
  text keys

Comments (Cloudflare D1, Waline):
  comment list [--path /articles/...] [--status approved|waiting|spam]
               [--limit 20] [--json] [--local]
  comment show <id>
  comment approve <id>
  comment spam <id>
  comment delete <id>
  comment reply <id> <text>

Build and deploy:
  dev | build | deploy | content

Environment:
  CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or run \`npx wrangler login\`.
  You can put them in .env.local.
`);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function wranglerResults(sql) {
  if (!fs.existsSync(WRANGLER)) {
    throw new Error("wrangler is not installed. Run `npm install` first.");
  }
  const args = [
    WRANGLER,
    "d1",
    "execute",
    "youzilm-waline",
    flags.local ? "--local" : "--remote",
    "--config",
    path.join("services", "waline", "wrangler.toml"),
    "--command",
    sql,
    "--json",
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    if (!process.env.CLOUDFLARE_API_TOKEN) {
      console.error(
        "Tip: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env.local, or run `npx wrangler login`.",
      );
    }
    throw new Error((result.stderr || result.stdout || "wrangler failed").trim());
  }

  const start = result.stdout.indexOf("[");
  if (start === -1) throw new Error(result.stdout.trim());
  const payload = JSON.parse(result.stdout.slice(start));
  return payload[0]?.results ?? [];
}

async function cmdList() {
  const lang = typeof flags.lang === "string" ? validateLang(flags.lang) : null;
  const groups = groupPosts(lang)
    .filter((group) =>
      flags.drafts
        ? Object.values(group.versions).some((post) => post.draft)
        : true,
    )
    .sort((a, b) => {
      const da = groupPrimary(a).date;
      const db = groupPrimary(b).date;
      return db.localeCompare(da) || a.slug.localeCompare(b.slug);
    });

  if (groups.length === 0) {
    console.log("No posts.");
    return;
  }

  printTable(
    ["DATE", "LANGS", "STATE", "TITLE", "SLUG"],
    groups.map((group) => {
      const primary = groupPrimary(group);
      return [
        primary.date,
        groupLanguages(group).join("+"),
        groupState(group),
        primary.title,
        group.slug,
      ];
    }),
  );
}

async function cmdNew() {
  const lang = validateLang(typeof flags.lang === "string" ? flags.lang : "zh");
  const title =
    typeof flags.title === "string" ? flags.title : await ask("Title");
  if (!title) throw new Error("A title is required.");

  const slug =
    typeof flags.slug === "string" ? flags.slug : await ask("Slug", suggestSlug(title));
  validateSlug(slug);

  const file = path.join(POSTS, lang, `${slug}.md`);
  if (fs.existsSync(file)) throw new Error(`Already exists: ${path.relative(ROOT, file)}`);

  const date = typeof flags.date === "string" ? flags.date : today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must look like 2026-11-13.");

  const summary =
    typeof flags.summary === "string" ? flags.summary : await ask("Summary (optional)", "");

  const availableTags = readJson(TAGS_FILE).map((tag) => tag.key);
  let tagInput = typeof flags.tags === "string" ? flags.tags : "";
  if (!tagInput && stdin.isTTY) {
    console.log(`Available tags: ${availableTags.join(", ")}`);
    tagInput = await ask("Tags (comma separated, optional)", "");
  }
  const tags = tagInput
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  for (const tag of tags) {
    if (!availableTags.includes(tag)) {
      console.warn(
        `Warning: "${tag}" is not in content/tags.json. Add it there or use an existing key.`,
      );
    }
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `${frontmatter({ title, date, summary, tags, draft: Boolean(flags.draft) })}\n在这里写正文。\n`,
    "utf8",
  );
  console.log(`Created ${path.relative(ROOT, file)}`);

  if (!flags["no-edit"]) openEditor(file);
  rebuildContent();
  console.log(`\nNext: npm run dev`);
  console.log(`Publish: npm run blog-cli -- publish ${slug}${lang === "zh" ? "" : " --lang en"}`);
}

async function cmdEdit() {
  const slug = positionals[0];
  if (!slug) throw new Error("Usage: npm run blog-cli -- edit <slug> [--lang zh|en]");
  const { file, lang } = await resolvePost(
    slug,
    typeof flags.lang === "string" ? flags.lang : null,
  );
  openEditor(file);
  rebuildContent();
  console.log(`Edited ${path.relative(ROOT, file)} (${lang}).`);
}

async function cmdDelete() {
  const slug = positionals[0];
  if (!slug) throw new Error("Usage: npm run blog-cli -- delete <slug> [--lang zh|en]");
  const group = getGroup(slug);
  if (!group) throw new Error(`No post found for slug "${slug}".`);

  const lang = typeof flags.lang === "string" ? flags.lang : null;
  const targets = selectedVersions(group, lang);
  const label = lang
    ? `${slug} (${lang})`
    : `${slug} (${groupLanguages(group).join(" + ")})`;

  if (!(await confirm(`Delete ${label}?`, false))) {
    console.log("Cancelled.");
    return;
  }

  for (const post of targets) fs.unlinkSync(post.file);
  rebuildContent();
  console.log(`Deleted ${label}.`);
}

async function cmdToggleDraft(publish) {
  const slug = positionals[0];
  if (!slug) {
    throw new Error(`Usage: npm run blog-cli -- ${publish ? "publish" : "draft"} <slug> [--lang zh|en]`);
  }

  const group = getGroup(slug);
  if (!group) throw new Error(`No post found for slug "${slug}".`);

  const lang = typeof flags.lang === "string" ? flags.lang : null;
  const targets = selectedVersions(group, lang);

  for (const post of targets) {
    const parsed = matter(fs.readFileSync(post.file, "utf8"));
    const data = { ...parsed.data };
    const date = normalizeDate(data.date);
    if (date) data.date = date;
    if (publish) delete data.draft;
    else data.draft = true;
    fs.writeFileSync(post.file, matter.stringify(parsed.content, data), "utf8");
  }

  rebuildContent();
  const label = lang
    ? `${slug} (${lang})`
    : `${slug} (${groupLanguages(group).join(" + ")})`;
  console.log(`${publish ? "Published" : "Marked as draft"}: ${label}.`);
}

async function cmdTranslate() {
  const slug = positionals[0];
  if (!slug) throw new Error("Usage: npm run blog-cli -- translate <slug>");
  const zhFile = path.join(POSTS, "zh", `${slug}.md`);
  const enFile = path.join(POSTS, "en", `${slug}.md`);
  if (!fs.existsSync(zhFile)) throw new Error(`Chinese post not found: ${slug}`);
  if (fs.existsSync(enFile)) throw new Error(`English post already exists: ${slug}`);

  const original = matter(fs.readFileSync(zhFile, "utf8"));
  const title =
    typeof flags.title === "string"
      ? flags.title
      : await ask("English title", String(original.data.title || ""));
  const summary =
    typeof flags.summary === "string"
      ? flags.summary
      : await ask("English summary", String(original.data.summary || ""));
  const date = normalizeDate(original.data.date) || today();
  const tags = Array.isArray(original.data.tags) ? original.data.tags.map(String) : [];

  const header = frontmatter({ title, date, summary, tags, draft: true });
  const note = `<!-- Translate this post, then publish it with:\n     npm run blog-cli -- publish ${slug} --lang en -->\n\n`;
  fs.mkdirSync(path.dirname(enFile), { recursive: true });
  fs.writeFileSync(enFile, header + note + original.content, "utf8");

  console.log(`Created draft ${path.relative(ROOT, enFile)}`);
  if (!flags["no-edit"]) openEditor(enFile);
  rebuildContent();
  console.log(`\nWhen the translation is ready: npm run blog-cli -- publish ${slug} --lang en`);
}

async function cmdPage() {
  const page = positionals[0];
  if (page !== "about" && page !== "now") {
    throw new Error("Usage: npm run blog-cli -- page <about|now> [--lang zh|en]");
  }
  const lang = validateLang(typeof flags.lang === "string" ? flags.lang : "zh");
  const file = path.join(PAGES, lang, `${page}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Not found: ${path.relative(ROOT, file)}. Create it first, or edit --lang zh.`,
    );
  }
  openEditor(file);
  rebuildContent();
  console.log(`Edited ${path.relative(ROOT, file)}.`);
}

const TEXT_ALIASES = {
  url: "url",
  "site-name": "name.zh",
  "site-name-en": "name.en",
  author: "author.zh",
  "author-en": "author.en",
  tagline: "tagline.zh",
  "tagline-en": "tagline.en",
  description: "description.zh",
  "description-en": "description.en",
  bio: "bio.zh",
  "bio-en": "bio.en",
  now: "now.zh",
  "now-en": "now.en",
  github: "github",
  x: "x",
  "waline-url": "walineUrl",
  license: "license",
  "license-url": "licenseUrl",
  "start-year": "startYear",
};

function resolveKey(key) {
  return TEXT_ALIASES[key] || key;
}

function getPath(object, key) {
  return key.split(".").reduce((value, part) => (value == null ? value : value[part]), object);
}

function setPath(object, key, value) {
  const parts = key.split(".");
  let cursor = object;
  for (const part of parts.slice(0, -1)) {
    if (typeof cursor[part] !== "object" || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

async function cmdText() {
  const action = positionals[0] || "get";
  const site = readJson(SITE_FILE);

  if (action === "keys") {
    for (const [alias, key] of Object.entries(TEXT_ALIASES)) {
      console.log(`${alias.padEnd(16)} ${key}`);
    }
    return;
  }

  if (action === "get") {
    const key = positionals[1] ? resolveKey(positionals[1]) : null;
    if (!key) {
      console.log(JSON.stringify(site, null, 2));
      return;
    }
    const value = getPath(site, key);
    if (value === undefined) throw new Error(`Unknown key: ${key}`);
    console.log(typeof value === "object" ? JSON.stringify(value, null, 2) : value);
    return;
  }

  if (action !== "set") {
    throw new Error("Usage: npm run blog-cli -- text get|set|keys [key] [value]");
  }

  const alias = positionals[1];
  if (!alias) throw new Error("Usage: npm run blog-cli -- text set <key> <value>");
  const key = resolveKey(alias);
  let value = positionals.slice(2).join(" ");
  if (!value) value = await ask(`Value for ${alias}`);
  if (!value) throw new Error("A value is required.");

  if (key === "startYear") {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error("start-year must be a four-digit year.");
    }
    value = year;
  }

  setPath(site, key, value);
  writeJson(SITE_FILE, site);
  console.log(`Updated ${alias} (${key}).`);
  console.log("Run `npm run dev` to see it, or `npm run deploy` to publish.");
}

async function cmdComment() {
  const action = positionals[0] || "list";

  if (action === "list") {
    const limit = Math.min(200, Math.max(1, Number(flags.limit) || 20));
    const where = [];
    if (typeof flags.path === "string") where.push(`url = ${sqlString(flags.path)}`);
    if (typeof flags.status === "string" && flags.status !== "all") {
      where.push(`status = ${sqlString(flags.status)}`);
    }
    const sql = `SELECT id, status, nick, url,
      substr(COALESCE(orig, comment, ''), 1, 80) AS excerpt,
      insertedAt
      FROM wl_Comment
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY id DESC LIMIT ${limit}`;
    const rows = wranglerResults(sql);
    if (flags.json) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    if (rows.length === 0) {
      console.log("No comments.");
      return;
    }
    printTable(
      ["ID", "STATUS", "NICK", "URL", "DATE", "COMMENT"],
      rows.map((row) => [
        row.id,
        row.status,
        row.nick,
        row.url,
        String(row.insertedAt || "").slice(0, 16).replace("T", " "),
        String(row.excerpt || "").replace(/\s+/g, " "),
      ]),
    );
    return;
  }

  const id = Number(positionals[1]);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Usage: npm run blog-cli -- comment <show|approve|spam|delete|reply> <id> ...");
  }

  if (action === "show") {
    const rows = wranglerResults(`SELECT * FROM wl_Comment WHERE id = ${id}`);
    if (rows.length === 0) throw new Error(`Comment #${id} not found.`);
    console.log(JSON.stringify(rows[0], null, 2));
    return;
  }

  if (action === "approve" || action === "spam") {
    wranglerResults(
      `UPDATE wl_Comment
       SET status = ${sqlString(action === "approve" ? "approved" : "spam")},
           updatedAt = datetime('now')
       WHERE id = ${id}`,
    );
    console.log(`Comment #${id} marked ${action === "approve" ? "approved" : "spam"}.`);
    return;
  }

  if (action === "delete") {
    if (!(await confirm(`Delete comment #${id}?`, false))) {
      console.log("Cancelled.");
      return;
    }
    wranglerResults(
      `DELETE FROM wl_CommentRegion WHERE comment_id = ${id};
       DELETE FROM wl_Comment WHERE id = ${id};`,
    );
    console.log(`Comment #${id} deleted.`);
    return;
  }

  if (action === "reply") {
    const text = positionals.slice(2).join(" ").trim();
    if (!text) throw new Error("Usage: npm run blog-cli -- comment reply <id> <text>");
    const parent = wranglerResults(
      `SELECT id, url, pid, rid FROM wl_Comment WHERE id = ${id}`,
    )[0];
    if (!parent) throw new Error(`Comment #${id} not found.`);
    const admin = wranglerResults(
      `SELECT id, display_name, email FROM wl_Users
       WHERE type = 'administrator' ORDER BY id LIMIT 1`,
    )[0];
    const rootId = parent.rid ?? parent.pid ?? parent.id;
    const html = `<p>${text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replace(/\n/g, "<br>")}</p>`;
    wranglerResults(
      `INSERT INTO wl_Comment
        (user_id, comment, orig, ip, link, mail, nick, pid, rid, status, like, ua, url,
         insertedAt, createdAt, updatedAt)
       VALUES
        (${admin?.id ?? "NULL"}, ${sqlString(html)}, ${sqlString(text)}, '', '', ${sqlString(
          admin?.email || "",
        )}, ${sqlString(admin?.display_name || "柚子")}, ${id}, ${rootId}, 'approved', 0,
         'blog-cli', ${sqlString(parent.url)}, datetime('now'), datetime('now'), datetime('now'))`,
    );
    console.log(`Replied to comment #${id}.`);
    return;
  }

  throw new Error(`Unknown comment action: ${action}`);
}

function runNpm(script) {
  const result = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exitCode = result.status ?? 1;
}

async function main() {
  const cmd = command || "help";
  if (flags.help) {
    usage();
    return;
  }

  switch (cmd) {
    case "help":
    case "-h":
      usage();
      return;
    case "list":
      await cmdList();
      return;
    case "new":
      await cmdNew();
      return;
    case "edit":
      await cmdEdit();
      return;
    case "delete":
      await cmdDelete();
      return;
    case "draft":
      await cmdToggleDraft(false);
      return;
    case "publish":
      await cmdToggleDraft(true);
      return;
    case "translate":
      await cmdTranslate();
      return;
    case "page":
      await cmdPage();
      return;
    case "text":
      await cmdText();
      return;
    case "comment":
    case "comments":
      await cmdComment();
      return;
    case "content":
      rebuildContent();
      return;
    case "dev":
      runNpm("dev");
      return;
    case "build":
      runNpm("build");
      return;
    case "deploy":
      runNpm("deploy");
      return;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      usage();
      process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(closeRl);

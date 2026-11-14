import { parse, stringify } from "yaml";
import { baseDictionaries } from "../../src/lib/i18n";
import { HttpError } from "../types";
export const jsonFiles = ["content/site.json", "content/ui.json", "content/tags.json", "content/projects.json", "content/links.json"];
export function managedText(path: string) {
  return jsonFiles.includes(path) || /^content\/posts\/(zh|en)\/[a-z0-9][a-z0-9-]*\.md$/.test(path) ||
    /^content\/pages\/(zh|en)\/(about|now)\.md$/.test(path);
}
export function managedImage(path: string) {
  return /^public\/images\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(png|jpe?g|webp|gif|avif)$/i.test(path);
}
export function parseDocument(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = parse(match[1], { maxAliasCount: 50 }) || {};
  if (typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "文章元数据必须是对象。");
  return { data, body: match[2].replace(/^\n/, "") };
}
export function serializeDocument(data: Record<string, unknown>, body: string): string {
  return "---\n" + stringify(data, { lineWidth: 0 }).trimEnd() + "\n---\n\n" + body.replace(/^\n+/, "").trimEnd() + "\n";
}
export function flatten(value: unknown, prefix = ""): { key: string; value: string }[] {
  if (typeof value === "string") return [{ key: prefix, value }];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? prefix + "." + k : k));
}
export const uiDefaults = { zh: flatten(baseDictionaries.zh), en: flatten(baseDictionaries.en) };
function fail(message: string): never { throw new HttpError(400, message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("配置必须是对象。");
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, allowEmpty = false): asserts value is string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > 20000) fail(name + "格式无效。");
}
function url(value: unknown, name: string) {
  text(value, name);
  try { if (!["http:", "https:"].includes(new URL(value).protocol)) fail(name + "必须是 http/https 地址。"); }
  catch { fail(name + "地址无效。"); }
}
function bilingual(value: unknown, name: string) {
  const data = object(value); text(data.zh, name + "（中文）", true); text(data.en, name + "（英文）", true);
}
export function validDate(value: unknown): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateFile(path: string, content: string) {
  if (!managedText(path)) fail("不允许编辑此文件。");
  if (new TextEncoder().encode(content).length > 256000) fail("单个文本文件不能超过 256 KB。");
  if (path.endsWith(".md")) {
    const { data } = parseDocument(content);
    text(data.title, "标题");
    if (path.includes("/posts/") && !validDate(data.date)) fail("文章日期必须是有效的 YYYY-MM-DD。");
    if (data.date && !validDate(data.date)) fail("日期无效。");
    if (data.updated && !validDate(data.updated)) fail("更新日期无效。");
    if (data.draft !== undefined && typeof data.draft !== "boolean") fail("草稿状态必须是布尔值。");
    if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.some(t => typeof t !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(t)))) fail("标签 key 格式无效。");
    return;
  }
  let value: unknown;
  try { value = JSON.parse(content); } catch { fail("JSON 格式无效。"); }
  if (path.endsWith("/site.json")) {
    const data = object(value);
    for (const k of ["name", "author", "tagline", "description", "bio", "now"]) bilingual(data[k], k);
    for (const k of ["url", "github", "x", "walineUrl", "licenseUrl"]) url(data[k], k);
    text(data.license, "许可证");
    if (!Number.isInteger(data.startYear) || Number(data.startYear) < 1970 || Number(data.startYear) > 9999) fail("起始年份无效。");
  } else if (path.endsWith("/ui.json")) {
    const data = object(value);
    for (const locale of ["zh", "en"] as const) {
      const allowed = new Set(uiDefaults[locale].map(row => row.key));
      for (const row of flatten(data[locale] || {})) if (!allowed.has(row.key)) fail("未知的 UI 文案：" + row.key);
      const check = (node: unknown) => {
        if (typeof node === "string") return;
        for (const [k, child] of Object.entries(object(node))) {
          if (["__proto__", "constructor", "prototype"].includes(k)) fail("文案 key 无效。");
          check(child);
        }
      };
      check(data[locale] || {});
    }
  } else if (path.endsWith("/tags.json")) {
    if (!Array.isArray(value)) fail("标签必须是数组。");
    const seen = new Set();
    for (const tag of value) {
      const data = object(tag); text(data.key, "标签 key");
      if (!/^[a-z0-9][a-z0-9-]*$/.test(data.key) || seen.has(data.key)) fail("标签 key 重复或格式无效。");
      seen.add(data.key); text(data.zh, "中文名称"); text(data.en, "英文名称");
    }
  } else if (path.endsWith("/projects.json")) {
    if (!Array.isArray(value)) fail("作品必须是数组。");
    const seen = new Set();
    for (const project of value) {
      const data = object(project); text(data.slug, "作品 slug");
      if (!/^[a-z0-9][a-z0-9-]*$/.test(data.slug) || seen.has(data.slug)) fail("作品 slug 重复或无效。");
      seen.add(data.slug); text(data.title, "作品名称"); text(data.year, "年份"); bilingual(data.description, "作品描述");
      if (!Array.isArray(data.tech) || data.tech.some(t => typeof t !== "string")) fail("技术栈必须是字符串数组。");
      if (!Array.isArray(data.links)) fail("作品链接必须是数组。");
      for (const item of data.links) { const link = object(item); text(link.label, "链接名称"); url(link.url, "作品链接"); }
    }
  } else if (path.endsWith("/links.json")) {
    const data = object(value);
    for (const group of ["friends", "elsewhere"]) {
      if (!Array.isArray(data[group])) fail("友链必须是数组。");
      for (const item of data[group] as unknown[]) {
        const link = object(item); text(link.name, "站点名称"); url(link.url, "友链"); bilingual(link.description, "友链描述");
      }
    }
  }
}

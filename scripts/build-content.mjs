#!/usr/bin/env node
/**
 * Build-time content pipeline.
 *
 * Markdown in content/ is rendered to HTML here, once, so that the running
 * Worker never needs a Markdown parser, Shiki, or the file system.
 *
 * Outputs:
 *   src/generated/content.json   metadata, rendered HTML, TOC, pages, stats
 *   public/search-index.json     plain-text index for client-side search
 */
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkAlert from "remark-github-blockquote-alert";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { toString as hastToString } from "hast-util-to-string";
import { toString as mdastToString } from "mdast-util-to-string";
import { imageSize } from "image-size";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content");
const POSTS_DIR = path.join(CONTENT_DIR, "posts");
const PAGES_DIR = path.join(CONTENT_DIR, "pages");
const OUT_CONTENT = path.join(ROOT, "src", "generated", "content.json");
const OUT_SEARCH = path.join(ROOT, "public", "search-index.json");

const SITE_URL = "https://youzilm.top";
const LANGS = ["zh", "en"];
const DRAFTS = process.env.INCLUDE_DRAFTS === "1";

const LABELS = {
  zh: {
    copy: "复制",
    copied: "已复制",
    copyCode: "复制代码",
    headingLink: "链接到这一节",
    about: "关于",
    now: "现在",
  },
  en: {
    copy: "Copy",
    copied: "Copied",
    copyCode: "Copy code",
    headingLink: "Link to this section",
    about: "About",
    now: "Now",
  },
};

function warn(message) {
  console.warn(`[content] ${message}`);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function listMarkdown(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        files.push(...(await listMarkdown(path.join(dir, entry.name))));
      } else if (entry.name.endsWith(".md")) {
        files.push(path.join(dir, entry.name));
      }
    }
    return files.sort();
  } catch {
    return [];
  }
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return null;
}

function countWords(text) {
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latin = (
    text
      .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ")
      .match(/[A-Za-z0-9_]+/g) || []
  ).length;
  const words = cjk + latin;
  const minutes = Math.max(1, Math.ceil(cjk / 350 + latin / 220));
  return { words, minutes };
}

/**
 * rehype plugin: collect h2/h3 headings after slugs have been added.
 */
/**
 * rehype-raw rebuilds the tree and drops node.data, which is where the code
 * fence meta (title="...") lives. Keep it on a property first.
 */
function rehypePreserveMeta() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "code" || !node.data?.meta) return;
      node.properties = node.properties || {};
      if (!node.properties.metastring) node.properties.metastring = node.data.meta;
    });
  };
}

function rehypeCollectToc(toc) {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const id = node.properties?.id;
      if (!id || id === "footnote-label") return;
      toc.push({
        id: String(id),
        text: hastToString(node).trim(),
        depth: Number(node.tagName.slice(1)),
      });
    });
  };
}

/**
 * rehype plugin: wrap local images in figures, add dimensions and lazy loading.
 */
function rehypeImages() {
  function decorate(image) {
    const props = image.properties || (image.properties = {});
    props.loading = "lazy";
    props.decoding = "async";
    props["data-zoomable"] = "";

    const src = typeof props.src === "string" ? props.src : "";
    if (!src.startsWith("/")) return;
    const file = path.join(ROOT, "public", src.replace(/^\//, ""));
    try {
      const size = imageSize(fsSync.readFileSync(file));
      if (size.width && size.height) {
        if (!props.width) props.width = size.width;
        if (!props.height) props.height = size.height;
      }
    } catch {
      // A missing image is reported by the browser, not the build.
    }
  }

  function toFigure(image, title) {
    delete image.properties.title;
    return {
      type: "element",
      tagName: "figure",
      properties: { className: ["md-figure"] },
      children: [
        image,
        {
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: [{ type: "text", value: String(title) }],
        },
      ],
    };
  }

  return (tree) => {
    function walk(parent) {
      if (!parent.children) return;
      const next = [];

      for (const node of parent.children) {
        if (node.type !== "element") {
          next.push(node);
          continue;
        }

        // A paragraph containing only an image becomes a figure, which keeps
        // block-level content out of <p>.
        if (node.tagName === "p") {
          const meaningful = node.children.filter(
            (child) => !(child.type === "text" && !child.value.trim()),
          );
          const image = meaningful.length === 1 && meaningful[0].tagName === "img"
            ? meaningful[0]
            : null;
          if (image) {
            decorate(image);
            if (image.properties?.title) {
              next.push(toFigure(image, image.properties.title));
              continue;
            }
          }
        }

        if (node.tagName === "img") {
          decorate(node);
          if (node.properties?.title && parent.tagName !== "a" && parent.tagName !== "p") {
            next.push(toFigure(node, node.properties.title));
            continue;
          }
        }

        if (node.tagName !== "a" && node.tagName !== "figure") walk(node);
        next.push(node);
      }

      parent.children = next;
    }

    walk(tree);
  };
}

/**
 * rehype plugin: external links open in a new tab.
 */
function rehypeExternalLinks() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      if (!/^https?:\/\//.test(href)) return;
      if (href.startsWith(SITE_URL)) return;

      node.properties.target = "_blank";
      node.properties.rel = ["noopener", "noreferrer"];
      node.properties.className = [
        ...(Array.isArray(node.properties.className) ? node.properties.className : []),
        "external",
      ];
    });
  };
}

/**
 * rehype plugin: wrap tables so they can scroll horizontally.
 */
function rehypeTableWrap() {
  return (tree) => {
    function walk(parent) {
      if (!parent.children) return;
      parent.children = parent.children.map((node) => {
        if (node.type !== "element") return node;
        if (node.tagName === "table") {
          return {
            type: "element",
            tagName: "div",
            properties: { className: ["table-wrap"] },
            children: [node],
          };
        }
        if (node.tagName !== "div" || !node.properties?.className?.includes?.("table-wrap")) {
          walk(node);
        }
        return node;
      });
    }
    walk(tree);
  };
}

/**
 * rehype plugin: add a language header and copy button to code blocks.
 */
function rehypeCodeBlocks(lang, options) {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "figure") return;
      if (node.properties?.["data-rehype-pretty-code-figure"] === undefined) return;

      const pre = node.children.find((child) => child.tagName === "pre");
      const code = pre?.children.find((child) => child.tagName === "code");
      const titleNode = node.children.find(
        (child) =>
          child.tagName === "figcaption" &&
          child.properties?.["data-rehype-pretty-code-title"] !== undefined,
      );
      const rawLang =
        code?.properties?.["data-language"] ||
        node.properties?.["data-language"] ||
        "text";
      const language = String(rawLang || "text");
      const title = titleNode ? hastToString(titleNode).trim() : "";

      if (titleNode) {
        node.children = node.children.filter((child) => child !== titleNode);
      }

      node.properties.className = [
        ...(Array.isArray(node.properties.className) ? node.properties.className : []),
        "md-code",
      ];
      node.properties["data-lang"] = language;

      const headChildren = [];
      if (language !== "text" && language !== "plaintext") {
        headChildren.push({
          type: "element",
          tagName: "span",
          properties: { className: ["code-lang"] },
          children: [{ type: "text", value: String(title || language) }],
        });
      }

      headChildren.push({
        type: "element",
        tagName: "button",
        properties: {
          type: "button",
          className: ["code-copy"],
          "data-code-copy": "",
          "data-copied-label": options.copied,
          "aria-label": options.copyCode,
        },
        children: [{ type: "text", value: options.copy }],
      });

      node.children.unshift({
        type: "element",
        tagName: "div",
        properties: {
          className: ["code-head", language === "text" ? "code-head--plain" : ""].filter(Boolean),
        },
        children: headChildren,
      });
    });
  };
}

const processorCache = new Map();

function getProcessor(lang) {
  if (processorCache.has(lang)) return processorCache.get(lang);
  const options = LABELS[lang];
  const toc = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkAlert)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypePreserveMeta)
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeCollectToc, toc)
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      properties: {
        className: ["heading-anchor"],
        "aria-label": options.headingLink,
      },
      content: {
        type: "element",
        tagName: "span",
        properties: { "aria-hidden": "true" },
        children: [{ type: "text", value: "#" }],
      },
    })
    .use(rehypeKatex, { strict: false })
    .use(rehypePrettyCode, {
      theme: { light: "github-light", dark: "github-dark" },
      keepBackground: false,
      defaultLang: "text",
      bypassInlineCode: true,
    })
    .use(rehypeCodeBlocks, lang, options)
    .use(rehypeImages)
    .use(rehypeExternalLinks)
    .use(rehypeTableWrap)
    .use(rehypeStringify);

  const entry = { processor, toc };
  processorCache.set(lang, entry);
  return entry;
}

export async function renderMarkdown(source, lang) {
  const { processor, toc } = getProcessor(lang);
  toc.length = 0;
  const file = await processor.process(source);
  const plain = mdastToString(
    unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(source),
  )
    .replace(/\s+/g, " ")
    .trim();
  const counts = countWords(plain);
  return {
    html: String(file),
    toc: [...toc],
    plain,
    words: counts.words,
    minutes: counts.minutes,
  };
}

async function loadPosts(tags) {
  const posts = [];
  const knownTags = new Map(tags.map((tag) => [tag.key, tag]));

  for (const lang of LANGS) {
    const files = await listMarkdown(path.join(POSTS_DIR, lang));
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      const { data, content } = matter(raw);
      const slug = path.basename(file, ".md");
      const date = normalizeDate(data.date);
      if (!date) {
        warn(`skipping ${path.relative(ROOT, file)}: missing or invalid "date"`);
        continue;
      }
      if (data.draft === true && !DRAFTS) {
        warn(`skipping draft ${path.relative(ROOT, file)}`);
        continue;
      }
      if (!data.title) {
        warn(`skipping ${path.relative(ROOT, file)}: missing "title"`);
        continue;
      }

      const postTags = Array.isArray(data.tags) ? data.tags.map(String) : [];
      for (const key of postTags) {
        if (!knownTags.has(key)) {
          warn(`unknown tag "${key}" in ${slug}; add it to content/tags.json`);
          const tag = { key, zh: key, en: key };
          tags.push(tag);
          knownTags.set(key, tag);
        }
      }

      const rendered = await renderMarkdown(content, lang);
      posts.push({
        lang,
        slug,
        title: String(data.title),
        date,
        updated: normalizeDate(data.updated) || null,
        summary: String(data.summary || rendered.plain.slice(0, 140)),
        tags: postTags,
        html: rendered.html,
        toc: rendered.toc,
        plain: rendered.plain,
        words: rendered.words,
        minutes: rendered.minutes,
      });
    }
  }

  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  return posts;
}

async function loadPages() {
  const pages = [];
  for (const lang of LANGS) {
    for (const slug of ["about", "now"]) {
      const file = path.join(PAGES_DIR, lang, `${slug}.md`);
      let raw;
      try {
        raw = await fs.readFile(file, "utf8");
      } catch {
        continue;
      }
      const { data, content } = matter(raw);
      const rendered = await renderMarkdown(content, lang);
      pages.push({
        lang,
        slug,
        title: String(data.title || LABELS[lang][slug] || slug),
        date: normalizeDate(data.date) || null,
        summary: String(data.summary || rendered.plain.slice(0, 140)),
        html: rendered.html,
        toc: rendered.toc,
        plain: rendered.plain,
        words: rendered.words,
        minutes: rendered.minutes,
      });
    }
  }
  return pages;
}

export function buildSearchRecords(posts, pages) {
  const records = [];
  const canonicalTags = new Map(posts.filter((post) => post.lang === "zh").map((post) => [post.slug, post.tags]));
  const urls = {
    about: { zh: "/about", en: "/en/about" },
    now: { zh: "/now", en: "/en/now" },
  };

  for (const locale of LANGS) {
    for (const post of posts) {
      const localized = posts.find((candidate) => candidate.lang === locale && candidate.slug === post.slug);
      const shown = localized || (post.lang === "zh" ? post : null);
      if (!shown) continue;
      if (localized && post.lang !== locale) continue;

      records.push({
        id: `${locale}:post:${post.slug}`,
        kind: "post",
        lang: locale,
        sourceLang: shown.lang,
        slug: post.slug,
        title: shown.title,
        summary: shown.summary,
        date: shown.date,
        tags: canonicalTags.get(shown.slug) || shown.tags,
        content: shown.plain,
        url: locale === "zh" ? `/articles/${post.slug}` : `/en/articles/${post.slug}`,
      });
    }

    for (const page of pages) {
      const localized = pages.find((candidate) => candidate.lang === locale && candidate.slug === page.slug);
      const shown = localized || (page.lang === "zh" ? page : null);
      if (!shown) continue;
      if (localized && page.lang !== locale) continue;
      records.push({
        id: `${locale}:page:${page.slug}`,
        kind: "page",
        lang: locale,
        sourceLang: shown.lang,
        slug: page.slug,
        title: shown.title,
        summary: shown.summary,
        date: shown.date || "",
        tags: [],
        content: shown.plain,
        url: urls[page.slug][locale],
      });
    }
  }

  // The loops above can add the same fallback record twice; de-duplicate by id.
  const seen = new Set();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

function postsForLocale(posts, locale) {
  if (locale === "zh") return posts.filter((post) => post.lang === "zh");

  const bySlug = new Map(
    posts.filter((post) => post.lang === "zh").map((post) => [post.slug, post]),
  );
  for (const post of posts) {
    if (post.lang === "en") bySlug.set(post.slug, post);
  }
  return [...bySlug.values()];
}

function computeStats(posts, locale) {
  const available = postsForLocale(posts, locale);
  const lastUpdated = available
    .map((post) => post.updated || post.date)
    .sort()
    .at(-1);

  return {
    totalPosts: available.length,
    totalWords: available.reduce((sum, post) => sum + post.words, 0),
    lastUpdated: lastUpdated || null,
  };
}

async function main() {
  await fs.mkdir(path.dirname(OUT_CONTENT), { recursive: true });
  await fs.mkdir(path.dirname(OUT_SEARCH), { recursive: true });

  const tags = await readJson(path.join(CONTENT_DIR, "tags.json"));
  const posts = await loadPosts(tags);
  const pages = await loadPages();

  const tagCounts = new Map();
  for (const locale of LANGS) {
    for (const post of postsForLocale(posts, locale)) {
      for (const key of post.tags) {
        const current = tagCounts.get(key) || { zh: 0, en: 0 };
        current[locale] += 1;
        tagCounts.set(key, current);
      }
    }
  }

  const tagsWithCounts = tags.map((tag) => {
    const counts = tagCounts.get(tag.key) || { zh: 0, en: 0 };
    return { ...tag, countZh: counts.zh, countEn: counts.en };
  });

  const content = {
    posts,
    pages,
    tags: tagsWithCounts,
    stats: {
      zh: computeStats(posts, "zh"),
      en: computeStats(posts, "en"),
    },
  };

  const searchRecords = buildSearchRecords(posts, pages);

  await fs.writeFile(OUT_CONTENT, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  await fs.writeFile(
    OUT_SEARCH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), records: searchRecords }, null, 2)}\n`,
    "utf8",
  );

  const counts = LANGS.map((lang) => `${lang}:${posts.filter((post) => post.lang === lang).length}`).join(" ");
  console.log(`[content] ${posts.length} posts (${counts}), ${pages.length} pages, ${tagsWithCounts.length} tags`);
  console.log(`[content] wrote ${path.relative(ROOT, OUT_CONTENT)} and ${path.relative(ROOT, OUT_SEARCH)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

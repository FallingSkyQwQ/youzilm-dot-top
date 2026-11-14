import { getPosts } from "./content";
import { getDict, localePath, type Locale } from "./i18n";
import { SITE } from "./site";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function absoluteHtml(html: string): string {
  return html.replace(/(src|href)="\/(?!\/)/g, `$1="${SITE.url}/`);
}

function rfcDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toUTCString();
}

export function buildFeed(locale: Locale): string {
  const d = getDict(locale);
  const posts = getPosts(locale);
  const home = new URL(localePath(locale, "/"), SITE.url).toString();
  const self = new URL(localePath(locale, "/feed.xml"), SITE.url).toString();
  const lastBuild = new Date().toUTCString();

  const items = posts
    .map((post) => {
      const url = new URL(localePath(locale, `/articles/${post.slug}`), SITE.url).toString();
      return [
        "<item>",
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${escapeXml(url)}</link>`,
        `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `<pubDate>${rfcDate(post.date)}</pubDate>`,
        `<description>${escapeXml(post.summary)}</description>`,
        `<content:encoded>${cdata(absoluteHtml(post.html))}</content:encoded>`,
        ...post.tags.map(
          (tag) => `<category>${escapeXml(tag)}</category>`,
        ),
        "</item>",
      ].join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    "<channel>",
    `<title>${escapeXml(d.siteName)}</title>`,
    `<link>${escapeXml(home)}</link>`,
    `<description>${escapeXml(d.siteDescription)}</description>`,
    `<language>${locale === "zh" ? "zh-CN" : "en"}</language>`,
    `<lastBuildDate>${lastBuild}</lastBuildDate>`,
    `<generator>Next.js</generator>`,
    `<atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml"/>`,
    items,
    "</channel>",
    "</rss>",
  ].join("");
}

export function feedResponse(locale: Locale): Response {
  return new Response(buildFeed(locale), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

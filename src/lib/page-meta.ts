import type { Metadata } from "next";
import { getPage, getPost, getTag } from "./content";
import { getDict, type Locale } from "./i18n";
import { pageMetadata } from "./metadata";

type StaticPageKey =
  | "articles"
  | "archive"
  | "tags"
  | "projects"
  | "guestbook"
  | "links"
  | "now"
  | "about"
  | "search";

export function staticPageMetadata(locale: Locale, key: StaticPageKey): Metadata {
  const d = getDict(locale);
  const page = key === "about" || key === "now" ? getPage(locale, key) : null;

  const entries: Record<StaticPageKey, { title: string; description: string; path: string }> = {
    articles: {
      title: d.posts.title,
      description: `${d.posts.title} · ${d.siteDescription}`,
      path: "/articles",
    },
    archive: {
      title: d.archive.title,
      description: `${d.archive.title} · ${d.siteDescription}`,
      path: "/archive",
    },
    tags: {
      title: d.tags.title,
      description: `${d.tags.title} · ${d.siteDescription}`,
      path: "/tags",
    },
    projects: {
      title: d.projects.title,
      description: d.projects.intro,
      path: "/projects",
    },
    guestbook: {
      title: d.guestbook.title,
      description: d.guestbook.intro,
      path: "/guestbook",
    },
    links: {
      title: d.links.title,
      description: d.links.intro,
      path: "/links",
    },
    now: {
      title: d.now.title,
      description: page?.summary || d.now.intro,
      path: "/now",
    },
    about: {
      title: d.about.title,
      description: page?.summary || d.siteDescription,
      path: "/about",
    },
    search: {
      title: d.search.title,
      description: d.search.hint,
      path: "/search",
    },
  };

  return pageMetadata({ locale, ...entries[key] });
}

export function postMetadata(locale: Locale, slug: string): Metadata {
  const post = getPost(locale, slug);
  if (!post) return {};
  const tags = post.tags.map((key) => getTag(locale, key)?.label ?? key);

  return pageMetadata({
    locale,
    title: post.title,
    description: post.summary,
    path: `/articles/${slug}`,
    type: "article",
    publishedTime: post.date,
    modifiedTime: post.updated || post.date,
    tags,
  });
}

export function tagMetadata(locale: Locale, key: string): Metadata {
  const tag = getTag(locale, key);
  if (!tag) return {};
  return pageMetadata({
    locale,
    title: `#${tag.label}`,
    description:
      locale === "zh"
        ? `标签 #${tag.label} 下的 ${tag.count} 篇文章。`
        : `${tag.count} posts tagged #${tag.label}.`,
    path: `/tags/${key}`,
  });
}

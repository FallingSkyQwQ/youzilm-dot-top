import contentJson from "@/generated/content.json";
import projectsJson from "../../content/projects.json";
import linksJson from "../../content/links.json";
import type { Locale } from "./i18n";

export type TocItem = {
  id: string;
  text: string;
  depth: number;
};

export type Post = {
  lang: Locale;
  slug: string;
  title: string;
  date: string;
  updated: string | null;
  summary: string;
  tags: string[];
  html: string;
  toc: TocItem[];
  plain: string;
  words: number;
  minutes: number;
};

export type LocalizedPost = Post & {
  isFallback: boolean;
  sourceLang: Locale;
};

export type ContentPage = {
  lang: Locale;
  slug: string;
  title: string;
  date: string | null;
  summary: string;
  html: string;
  toc: TocItem[];
  plain: string;
  words: number;
  minutes: number;
};

export type LocalizedPage = ContentPage & {
  isFallback: boolean;
  sourceLang: Locale;
};

export type Tag = {
  key: string;
  zh: string;
  en: string;
  countZh: number;
  countEn: number;
};

export type LocalizedTag = Tag & {
  label: string;
  count: number;
};

export type Project = {
  slug: string;
  year: string;
  title: string;
  description: { zh: string; en: string };
  tech: string[];
  links: { label: string; url: string }[];
};

export type LocaleProject = Omit<Project, "description"> & {
  description: string;
};

export type SiteLink = {
  name: string;
  url: string;
  description: { zh: string; en: string };
};

export type LocaleLink = Omit<SiteLink, "description"> & {
  description: string;
};

type ContentData = {
  posts: Post[];
  pages: ContentPage[];
  tags: Tag[];
  stats: Record<Locale, { totalPosts: number; totalWords: number; lastUpdated: string | null }>;
};

const data = contentJson as unknown as ContentData;
const projects = projectsJson as Project[];
const links = linksJson as {
  friends: SiteLink[];
  elsewhere: SiteLink[];
};

const zhBySlug = new Map(
  data.posts.filter((post) => post.lang === "zh").map((post) => [post.slug, post]),
);

function byDateDesc(a: Post, b: Post): number {
  return b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);
}

/**
 * zh and en files with the same slug are two versions of one article.
 * The Chinese version owns the canonical tags; the localized version owns
 * the title, summary, body, and URL.
 */
function localizePost(
  post: Post,
  isFallback: boolean,
  sourceLang: Locale,
): LocalizedPost {
  const canonical = zhBySlug.get(post.slug);
  return {
    ...post,
    tags: canonical ? canonical.tags : post.tags,
    isFallback,
    sourceLang,
  };
}

export function getPosts(locale: Locale): LocalizedPost[] {
  const posts = data.posts;
  if (locale === "zh") {
    return posts
      .filter((post) => post.lang === "zh")
      .map((post) => localizePost(post, false, "zh"))
      .sort(byDateDesc);
  }

  const bySlug = new Map(
    posts.filter((post) => post.lang === "zh").map((post) => [post.slug, post]),
  );
  for (const post of posts) {
    if (post.lang === "en") bySlug.set(post.slug, post);
  }

  return [...bySlug.values()]
    .map((post) => localizePost(post, post.lang !== "en", post.lang))
    .sort(byDateDesc);
}

export function getPost(locale: Locale, slug: string): LocalizedPost | null {
  if (locale === "zh") {
    const post = data.posts.find((candidate) => candidate.lang === "zh" && candidate.slug === slug);
    return post ? localizePost(post, false, "zh") : null;
  }

  const translated = data.posts.find(
    (candidate) => candidate.lang === "en" && candidate.slug === slug,
  );
  if (translated) {
    return localizePost(translated, false, "en");
  }

  const original = data.posts.find(
    (candidate) => candidate.lang === "zh" && candidate.slug === slug,
  );
  return original ? localizePost(original, true, "zh") : null;
}

export function getSlugs(locale: Locale): string[] {
  const slugs = new Set(
    data.posts
      .filter((post) => (locale === "zh" ? post.lang === "zh" : true))
      .map((post) => post.slug),
  );
  return [...slugs].sort();
}

export function getTags(locale: Locale): LocalizedTag[] {
  const posts = getPosts(locale);
  return data.tags
    .map((tag) => ({
      ...tag,
      label: tag[locale],
      count: posts.filter((post) => post.tags.includes(tag.key)).length,
    }))
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale));
}

export function getTag(locale: Locale, key: string): LocalizedTag | null {
  const tag = data.tags.find((candidate) => candidate.key === key);
  if (!tag) return null;
  return {
    ...tag,
    label: tag[locale],
    count: getPosts(locale).filter((post) => post.tags.includes(key)).length,
  };
}

export function getPostsByTag(locale: Locale, key: string): LocalizedPost[] {
  return getPosts(locale).filter((post) => post.tags.includes(key));
}

export function getAdjacentPosts(
  locale: Locale,
  slug: string,
): { previous: LocalizedPost | null; next: LocalizedPost | null } {
  const posts = getPosts(locale);
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: posts[index + 1] ?? null,
    next: posts[index - 1] ?? null,
  };
}

export function getRelatedPosts(locale: Locale, slug: string, limit = 3): LocalizedPost[] {
  const posts = getPosts(locale);
  const current = posts.find((post) => post.slug === slug);
  if (!current) return [];

  return posts
    .filter((post) => post.slug !== slug)
    .map((post) => {
      const shared = post.tags.filter((tag) => current.tags.includes(tag)).length;
      return { post, shared };
    })
    .filter((item) => item.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.post.date.localeCompare(a.post.date))
    .slice(0, limit)
    .map((item) => item.post);
}

export function getPage(locale: Locale, slug: string): LocalizedPage | null {
  const localized = data.pages.find(
    (page) => page.lang === locale && page.slug === slug,
  );
  if (localized) {
    return { ...localized, isFallback: false, sourceLang: locale };
  }
  if (locale === "en") {
    const original = data.pages.find(
      (page) => page.lang === "zh" && page.slug === slug,
    );
    if (original) {
      return { ...original, isFallback: true, sourceLang: "zh" };
    }
  }
  return null;
}

export function getStats(locale: Locale) {
  const posts = getPosts(locale);
  const lastUpdated = posts
    .map((post) => post.updated || post.date)
    .sort()
    .at(-1);

  return {
    totalPosts: posts.length,
    totalWords: posts.reduce((sum, post) => sum + post.words, 0),
    lastUpdated: lastUpdated || "",
  };
}

export function getContentLastUpdated(locale: Locale): string {
  return getStats(locale).lastUpdated;
}

export function getProjects(locale: Locale): LocaleProject[] {
  return projects.map((project) => ({
    ...project,
    description: project.description[locale] || project.description.zh,
  }));
}

export function getLinks(locale: Locale): {
  friends: LocaleLink[];
  elsewhere: LocaleLink[];
} {
  const localize = (link: SiteLink): LocaleLink => ({
    ...link,
    description: link.description[locale] || link.description.zh,
  });
  return {
    friends: links.friends.map(localize),
    elsewhere: links.elsewhere.map(localize),
  };
}

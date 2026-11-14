import { getDict, htmlLang, localePath, type Locale } from "./i18n";
import { SITE } from "./site";
import type { LocalizedPost, LocalizedPage } from "./content";

export function jsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function websiteJsonLd(locale: Locale) {
  const d = getDict(locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: d.siteName,
    url: new URL(localePath(locale, "/"), SITE.url).toString(),
    description: d.siteDescription,
    inLanguage: htmlLang[locale],
    publisher: {
      "@type": "Person",
      name: SITE.author,
      url: SITE.github,
    },
  };
}

export function blogPostingJsonLd(post: LocalizedPost, locale: Locale) {
  const url = new URL(localePath(locale, `/articles/${post.slug}`), SITE.url).toString();
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    inLanguage: post.isFallback
      ? "zh-CN"
      : locale === "zh"
        ? "zh-CN"
        : "en",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author: {
      "@type": "Person",
      name: SITE.author,
      url: SITE.github,
    },
    publisher: {
      "@type": "Person",
      name: SITE.author,
      url: SITE.github,
    },
    image: new URL("/og.png", SITE.url).toString(),
    keywords: post.tags.join(", "),
    wordCount: post.words,
    timeRequired: `PT${post.minutes}M`,
  };
}

export function pageJsonLd(page: LocalizedPage, locale: Locale, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.summary,
    url: new URL(localePath(locale, path), SITE.url).toString(),
    inLanguage: htmlLang[locale],
    isPartOf: {
      "@type": "WebSite",
      name: getDict(locale).siteName,
      url: new URL(localePath(locale, "/"), SITE.url).toString(),
    },
  };
}

import type { MetadataRoute } from "next";
import { getPosts, getStats, getTags } from "@/lib/content";
import { localePath, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

function absolute(path: string): string {
  return new URL(path, SITE.url).toString();
}

function languages(path: string) {
  return {
    languages: {
      "zh-CN": absolute(localePath("zh", path)),
      en: absolute(localePath("en", path)),
    },
  };
}

const staticPaths = [
  "/",
  "/articles",
  "/archive",
  "/tags",
  "/projects",
  "/guestbook",
  "/links",
  "/now",
  "/about",
  "/search",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const fallbackDate = new Date().toISOString().slice(0, 10);
  const lastUpdated = getStats("zh").lastUpdated || fallbackDate;

  for (const locale of ["zh", "en"] as Locale[]) {
    for (const path of staticPaths) {
      entries.push({
        url: absolute(localePath(locale, path)),
        lastModified: lastUpdated,
        changeFrequency: path === "/" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.7,
        alternates: languages(path),
      });
    }

    for (const tag of getTags(locale)) {
      entries.push({
        url: absolute(localePath(locale, `/tags/${tag.key}`)),
        lastModified: lastUpdated,
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: languages(`/tags/${tag.key}`),
      });
    }

    for (const post of getPosts(locale)) {
      entries.push({
        url: absolute(localePath(locale, `/articles/${post.slug}`)),
        lastModified: post.updated || post.date,
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: languages(`/articles/${post.slug}`),
      });
    }
  }

  return entries;
}

import type { Metadata } from "next";
import { getDict, htmlLang, localePath, type Locale } from "./i18n";
import { SITE } from "./site";

function ogImage(locale: Locale) {
  return {
    url: "/og.png",
    width: 1200,
    height: 630,
    alt:
      locale === "zh"
        ? "柚子的blog — 写代码，也写字。"
        : "youzilm — code, and the occasional essay.",
  };
}

export function layoutMetadata(locale: Locale): Metadata {
  const d = getDict(locale);
  const canonical = localePath(locale, "/");
  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: d.siteName,
      template: `%s · ${d.siteName}`,
    },
    description: d.siteDescription,
    applicationName: d.siteName,
    authors: [{ name: SITE.author, url: SITE.github }],
    creator: SITE.author,
    publisher: SITE.author,
    category: "technology",
    alternates: {
      canonical,
      languages: {
        "zh-CN": localePath("zh", "/"),
        en: localePath("en", "/"),
        "x-default": localePath("zh", "/"),
      },
    },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: ["/icon-192.png"],
    },
    openGraph: {
      type: "website",
      siteName: d.siteName,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      url: canonical,
      title: d.siteName,
      description: d.siteDescription,
      images: [ogImage(locale)],
    },
    twitter: {
      card: "summary_large_image",
      title: d.siteName,
      description: d.siteDescription,
      images: ["/og.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    other: {
      "content-language": htmlLang[locale],
    },
  };
}

type PageMetadataOptions = {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
};

export function pageMetadata({
  locale,
  title,
  description,
  path,
  type = "website",
  publishedTime,
  modifiedTime,
  tags,
}: PageMetadataOptions): Metadata {
  const d = getDict(locale);
  const canonical = new URL(localePath(locale, path), SITE.url).toString();
  const zhUrl = new URL(localePath("zh", path), SITE.url).toString();
  const enUrl = new URL(localePath("en", path), SITE.url).toString();

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        "zh-CN": zhUrl,
        en: enUrl,
        "x-default": zhUrl,
      },
    },
    keywords: tags,
    openGraph: {
      type,
      siteName: d.siteName,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      url: canonical,
      title,
      description,
      images: [ogImage(locale)],
      ...(type === "article"
        ? {
            publishedTime,
            modifiedTime,
            authors: [SITE.author],
            tags,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

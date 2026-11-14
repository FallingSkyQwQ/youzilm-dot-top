import { SITE } from "./site";
import uiOverrides from "../../content/ui.json";

const zhBase = {
  siteName: SITE.name,
  siteTagline: SITE.tagline.zh,
  siteDescription: SITE.description.zh,
  skipToContent: "跳到正文",
  navLabel: "主导航",

  nav: {
    home: "首页",
    articles: "文章",
    archive: "归档",
    tags: "标签",
    projects: "作品",
    guestbook: "留言板",
    links: "友链",
    now: "现在",
    about: "关于",
    search: "搜索",
  },

  actions: {
    search: "搜索",
    openSearch: "打开搜索",
    close: "关闭",
    menu: "菜单",
    theme: "切换主题",
    themeToLight: "切换到浅色模式",
    themeToDark: "切换到深色模式",
    language: "切换到英文",
    languageShort: "EN",
    rss: "RSS 订阅",
  },

  home: {
    eyebrow: `EST. ${SITE.startYear}`,
    tagline: SITE.tagline.zh,
    bio: SITE.bio.zh,
    now: SITE.now.zh,
    nowLink: "看看 /now",
    recent: "最近文章",
    all: "查看全部",
    findMe: "找到我",
    stats: "统计",
  },

  posts: {
    title: "文章",
    count: "共 {n} 篇",
    empty: "还没有文章。",
    rss: "RSS",
    fallback: "中文",
  },

  archive: {
    title: "归档",
    count: "共 {n} 篇",
    empty: "还没有文章。",
  },

  tags: {
    title: "标签",
    count: "共 {n} 个标签",
    empty: "还没有标签。",
  },

  tag: {
    title: "标签",
    count: "共 {n} 篇文章",
    back: "全部标签",
  },

  projects: {
    title: "作品",
    intro: "一些做过的、正在做的、做了一半的东西。",
    empty: "还没有整理好的项目。",
    source: "源码",
    tech: "技术",
  },

  links: {
    title: "友链",
    intro: "朋友们的网站，以及我常去的地方。",
    friends: "友链",
    friendsEmpty: "友链还在整理。如果你也有个人网站，欢迎通过 GitHub 或 X 告诉我。",
    elsewhere: "常去的地方",
  },

  now: {
    title: "现在",
    intro: "最近在做的事。",
  },

  about: {
    title: "关于",
    info: "信息",
    contact: "联系",
    license: "版权",
    stack: "本站",
    location: "居住地",
    languages: "语言",
    email: "邮箱",
    site: "网站",
  },

  guestbook: {
    title: "留言板",
    intro: "随便写点什么。可以问我问题，也可以只是打个招呼。",
  },

  search: {
    title: "搜索",
    placeholder: "输入关键词，多个词用空格分开",
    hint: "搜索全部文章和页面",
    shortcut: "⌘K / Ctrl+K",
    results: "结果",
    empty: "输入关键词开始搜索。",
    noResults: "没有找到匹配的内容。",
    loading: "正在载入索引…",
    error: "搜索暂时不可用。",
    page: "页面",
    post: "文章",
    close: "关闭搜索",
    navHint: "↑↓ 选择 · Enter 打开 · Esc 关闭",
    clear: "清空",
    matchIn: "匹配",
  },

  article: {
    published: "发布于",
    updated: "更新于",
    reading: "约 {n} 分钟",
    words: "{n} 字",
    views: "阅读",
    toc: "目录",
    tags: "标签",
    prev: "上一篇",
    next: "下一篇",
    nav: "文章导航",
    related: "相关文章",
    backToTop: "回到顶部",
    license: "本文以 CC BY 4.0 授权，转载请注明作者和出处。",
    quote: "引用评论",
    quoted: "已引用，写在评论里吧",
    quoteHint: "选中正文即可引用到评论",
    fallbackTitle: "这篇文章还没有英文版",
    fallbackBody: "下面是中文原文。",
    fallbackLink: "阅读中文版",
    comments: "评论",
    commentsLoading: "评论加载中…",
    share: "分享",
    copyLink: "复制链接",
    copied: "已复制链接",
    copy: "复制",
    copiedCode: "已复制",
    commentsError: "评论加载失败。",
  },

  footer: {
    updated: "最后更新于 {date}",
    posts: "{n} 篇文章",
    words: "{n} 字",
    built: "由 Next.js 与 Cloudflare 驱动",
    rss: "RSS",
    license: "CC BY 4.0",
    top: "回到顶部",
  },

  notFound: {
    title: "页面不存在",
    body: "这个地址没有对应的页面。可能是链接写错了，也可能是页面已经被移走。",
    back: "回到首页",
  },

  theme: {
    light: "浅色",
    dark: "深色",
  },
};

export type Dictionary = typeof zhBase;

const enBase: Dictionary = {
  siteName: SITE.nameEn,
  siteTagline: SITE.tagline.en,
  siteDescription: SITE.description.en,
  skipToContent: "Skip to content",
  navLabel: "Main navigation",

  nav: {
    home: "Home",
    articles: "Articles",
    archive: "Archive",
    tags: "Tags",
    projects: "Projects",
    guestbook: "Guestbook",
    links: "Links",
    now: "Now",
    about: "About",
    search: "Search",
  },

  actions: {
    search: "Search",
    openSearch: "Open search",
    close: "Close",
    menu: "Menu",
    theme: "Toggle theme",
    themeToLight: "Switch to light mode",
    themeToDark: "Switch to dark mode",
    language: "切换到中文",
    languageShort: "中",
    rss: "RSS feed",
  },

  home: {
    eyebrow: `EST. ${SITE.startYear}`,
    tagline: SITE.tagline.en,
    bio: SITE.bio.en,
    now: SITE.now.en,
    nowLink: "See /now",
    recent: "Recent posts",
    all: "View all",
    findMe: "Elsewhere",
    stats: "Stats",
  },

  posts: {
    title: "Articles",
    count: "{n} posts",
    empty: "No posts yet.",
    rss: "RSS",
    fallback: "中文",
  },

  archive: {
    title: "Archive",
    count: "{n} posts",
    empty: "No posts yet.",
  },

  tags: {
    title: "Tags",
    count: "{n} tags",
    empty: "No tags yet.",
  },

  tag: {
    title: "Tag",
    count: "{n} posts",
    back: "All tags",
  },

  projects: {
    title: "Projects",
    intro: "Things I have made, am making, or stopped making halfway through.",
    empty: "No projects here yet.",
    source: "Source",
    tech: "Tech",
  },

  links: {
    title: "Links",
    intro: "Sites kept by friends, and places I visit often.",
    friends: "Friends",
    friendsEmpty: "The list is still being put together. If you keep a personal site, tell me on GitHub or X.",
    elsewhere: "Elsewhere on the web",
  },

  now: {
    title: "Now",
    intro: "What I am doing lately.",
  },

  about: {
    title: "About",
    info: "Info",
    contact: "Contact",
    license: "License",
    stack: "Stack",
    location: "Based in",
    languages: "Languages",
    email: "Email",
    site: "Site",
  },

  guestbook: {
    title: "Guestbook",
    intro: "Leave a note. Ask a question, or just say hello.",
  },

  search: {
    title: "Search",
    placeholder: "Type a keyword; separate multiple words with spaces",
    hint: "Search every post and page",
    shortcut: "⌘K / Ctrl+K",
    results: "Results",
    empty: "Type something to start searching.",
    noResults: "Nothing matched.",
    loading: "Loading index…",
    error: "Search is unavailable right now.",
    page: "Page",
    post: "Post",
    close: "Close search",
    navHint: "↑↓ select · Enter open · Esc close",
    clear: "Clear",
    matchIn: "Match",
  },

  article: {
    published: "Published",
    updated: "Updated",
    reading: "≈ {n} min read",
    words: "{n} words",
    views: "Views",
    toc: "Contents",
    tags: "Tags",
    prev: "Previous",
    next: "Next",
    nav: "Post navigation",
    related: "Related",
    backToTop: "Back to top",
    license: "Licensed under CC BY 4.0. Please credit the author and link back.",
    quote: "Quote comment",
    quoted: "Quoted. Add your comment below.",
    quoteHint: "Select text to quote it in a comment",
    fallbackTitle: "This post is not available in English yet",
    fallbackBody: "The Chinese original is shown below.",
    fallbackLink: "Read the Chinese version",
    comments: "Comments",
    commentsLoading: "Loading comments…",
    share: "Share",
    copyLink: "Copy link",
    copied: "Link copied",
    copy: "Copy",
    copiedCode: "Copied",
    commentsError: "Comments failed to load.",
  },

  footer: {
    updated: "Last updated {date}",
    posts: "{n} posts",
    words: "{n} words",
    built: "Built with Next.js and Cloudflare",
    rss: "RSS",
    license: "CC BY 4.0",
    top: "Back to top",
  },

  notFound: {
    title: "Page not found",
    body: "There is no page at this address. The link may be wrong, or the page may have moved.",
    back: "Back home",
  },

  theme: {
    light: "Light",
    dark: "Dark",
  },
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function mergeOverrides<T extends Record<string, unknown>>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (!(key in base)) continue;
    const current = base[key];
    if (current && typeof current === "object" && !Array.isArray(current)) {
      merged[key] = mergeOverrides(
        current as Record<string, unknown>,
        value,
      );
    } else if (typeof current === "string" && typeof value === "string") {
      merged[key] = value;
    }
  }
  return merged as T;
}

const overrides = uiOverrides as {
  zh?: DeepPartial<Dictionary>;
  en?: DeepPartial<Dictionary>;
};

/**
 * content/ui.json holds strings edited from the admin website. Only keys that
 * already exist in the base dictionary are applied, so a typo cannot add
 * stray text to the site.
 */
const zh: Dictionary = mergeOverrides(zhBase, overrides.zh);
const en: Dictionary = mergeOverrides(enBase, overrides.en);

export const baseDictionaries = { zh: zhBase, en: enBase } as const;
export const dictionaries = { zh, en };
export type Locale = keyof typeof dictionaries;
export type SearchLabels = Dictionary["search"] & { fallback: string };
export const locales: Locale[] = ["zh", "en"];
export const htmlLang: Record<Locale, string> = { zh: "zh-CN", en: "en" };

export function getDict(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function localePath(locale: Locale, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === "zh") return normalized;
  return normalized === "/" ? "/en" : `/en${normalized}`;
}

export function stripLocale(pathname: string): string {
  return pathname.replace(/^\/en(?=\/|$)/, "") || "/";
}

export function otherLocaleHref(current: Locale, pathname: string): string {
  const stripped = stripLocale(pathname);
  return current === "zh" ? localePath("en", stripped) : stripped;
}

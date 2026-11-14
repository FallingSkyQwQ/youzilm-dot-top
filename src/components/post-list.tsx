import Link from "next/link";
import type { LocalizedPost } from "@/lib/content";
import { getDict, localePath, type Locale } from "@/lib/i18n";
import { TagLinks } from "./tag-links";

type Props = {
  posts: LocalizedPost[];
  locale: Locale;
  showSummary?: boolean;
  showTags?: boolean;
  empty?: string;
};

export function PostList({
  posts,
  locale,
  showSummary = true,
  showTags = true,
  empty,
}: Props) {
  const d = getDict(locale);

  if (posts.length === 0) {
    return <p className="empty-note">{empty ?? d.posts.empty}</p>;
  }

  return (
    <ol className="post-list">
      {posts.map((post) => (
        <li key={post.slug} className="post-item">
          <p className="post-line">
            <time className="post-date" dateTime={post.date}>
              [{post.date}]
            </time>{" "}
            <span className="post-title">
              <Link href={localePath(locale, `/articles/${post.slug}`)}>{post.title}</Link>
            </span>
            {post.isFallback ? (
              <span className="lang-mark" title={d.article.fallbackTitle}>
                [{d.posts.fallback}]
              </span>
            ) : null}
          </p>
          {showSummary ? <p className="post-summary">{post.summary}</p> : null}
          {showTags ? (
            <TagLinks locale={locale} tags={post.tags} className="tag-links--small" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

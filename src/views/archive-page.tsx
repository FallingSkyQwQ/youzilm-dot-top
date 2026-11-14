import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getPosts } from "@/lib/content";
import type { LocalizedPost } from "@/lib/content";
import { fill } from "@/lib/format";
import { getDict, localePath, type Locale } from "@/lib/i18n";

export function ArchivePage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const posts = getPosts(locale);
  const groups = new Map<string, LocalizedPost[]>();

  for (const post of posts) {
    const year = post.date.slice(0, 4);
    const current = groups.get(year) || [];
    current.push(post);
    groups.set(year, current);
  }

  return (
    <div className="wrap wrap--narrow">
      <PageHeader title={d.archive.title} meta={fill(d.archive.count, { n: posts.length })} />

      {groups.size === 0 ? <p className="empty-note">{d.archive.empty}</p> : null}

      {[...groups.entries()].map(([year, items]) => (
        <section className="archive-year" key={year}>
          <h2 className="archive-year__title">{year}</h2>
          <ol className="archive-list">
            {items.map((post) => (
              <li key={post.slug}>
                <span className="archive-date">
                  <time dateTime={post.date}>{post.date.slice(5)}</time>
                </span>
                <Link href={localePath(locale, `/articles/${post.slug}`)}>{post.title}</Link>
                {post.isFallback ? <span className="lang-mark">[{d.posts.fallback}]</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

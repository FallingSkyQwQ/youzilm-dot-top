import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PostList } from "@/components/post-list";
import { getPosts } from "@/lib/content";
import { fill } from "@/lib/format";
import { getDict, localePath, type Locale } from "@/lib/i18n";

export function ArticlesPage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const posts = getPosts(locale);

  return (
    <div className="wrap wrap--narrow">
      <PageHeader
        title={d.posts.title}
        meta={
          <>
            {fill(d.posts.count, { n: posts.length })}
            <span aria-hidden="true"> · </span>
            <Link href={localePath(locale, "/feed.xml")}>{d.posts.rss}</Link>
          </>
        }
      />
      <PostList posts={posts} locale={locale} />
    </div>
  );
}

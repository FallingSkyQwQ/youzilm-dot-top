import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PostList } from "@/components/post-list";
import { getPostsByTag, getTag } from "@/lib/content";
import { fill } from "@/lib/format";
import { getDict, localePath, type Locale } from "@/lib/i18n";

export function TagPage({ locale, tagKey }: { locale: Locale; tagKey: string }) {
  const d = getDict(locale);
  const tag = getTag(locale, tagKey);
  if (!tag) notFound();

  const posts = getPostsByTag(locale, tagKey);

  return (
    <div className="wrap wrap--narrow">
      <p className="breadcrumb">
        <Link href={localePath(locale, "/tags")}>{d.tag.back}</Link>
      </p>
      <PageHeader
        title={`#${tag.label}`}
        meta={fill(d.tag.count, { n: posts.length })}
      />
      <PostList posts={posts} locale={locale} empty={d.posts.empty} />
    </div>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getTags } from "@/lib/content";
import { fill, formatNumber } from "@/lib/format";
import { getDict, localePath, type Locale } from "@/lib/i18n";

export function TagsPage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const tags = getTags(locale);

  return (
    <div className="wrap wrap--narrow">
      <PageHeader title={d.tags.title} meta={fill(d.tags.count, { n: tags.length })} />

      {tags.length === 0 ? (
        <p className="empty-note">{d.tags.empty}</p>
      ) : (
        <ul className="tag-cloud">
          {tags.map((tag) => (
            <li key={tag.key}>
              <Link href={localePath(locale, `/tags/${tag.key}`)}>
                <span>#{tag.label}</span>
                <span className="tag-cloud__count">{formatNumber(tag.count, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

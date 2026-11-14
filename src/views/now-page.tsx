import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getPage } from "@/lib/content";
import { fill, formatDate } from "@/lib/format";
import { getDict, type Locale } from "@/lib/i18n";

export function NowPage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const page = getPage(locale, "now");
  if (!page) notFound();

  return (
    <div className="wrap wrap--narrow">
      <PageHeader
        title={page.title}
        meta={page.date ? fill(d.footer.updated, { date: formatDate(page.date) }) : undefined}
        description={d.now.intro}
      />
      <div className="prose" dangerouslySetInnerHTML={{ __html: page.html }} />
    </div>
  );
}

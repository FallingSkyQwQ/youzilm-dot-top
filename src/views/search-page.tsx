import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SearchPageClient } from "@/components/search-page-client";
import { getDict, type Locale } from "@/lib/i18n";

export function SearchPage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const labels = { ...d.search, fallback: d.posts.fallback };

  return (
    <div className="wrap wrap--narrow">
      <PageHeader title={d.search.title} description={d.search.hint} />
      <Suspense fallback={<p className="empty-note">{d.search.loading}</p>}>
        <SearchPageClient locale={locale} labels={labels} />
      </Suspense>
    </div>
  );
}

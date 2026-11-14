"use client";

import { useSearchParams } from "next/navigation";
import type { Locale, SearchLabels as Labels } from "@/lib/i18n";
import { SearchBox } from "./search-box";

type Props = {
  locale: Locale;
  labels: Labels;
};

export function SearchPageClient({ locale, labels }: Props) {
  const params = useSearchParams();
  const initialQuery = params.get("q") || "";

  return (
    <SearchBox
      locale={locale}
      labels={labels}
      initialQuery={initialQuery}
      autoFocus
      onQueryChange={(value) => {
        const url = new URL(window.location.href);
        if (value) url.searchParams.set("q", value);
        else url.searchParams.delete("q");
        window.history.replaceState(null, "", url);
      }}
    />
  );
}

import type { Metadata } from "next";
import { SearchPage } from "@/views/search-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("en", "search");

export default function Page() {
  return <SearchPage locale="en" />;
}

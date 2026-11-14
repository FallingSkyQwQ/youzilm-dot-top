import type { Metadata } from "next";
import { ArticlesPage } from "@/views/articles-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("en", "articles");

export default function Page() {
  return <ArticlesPage locale="en" />;
}

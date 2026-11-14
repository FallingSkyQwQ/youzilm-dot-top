import type { Metadata } from "next";
import { TagsPage } from "@/views/tags-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("en", "tags");

export default function Page() {
  return <TagsPage locale="en" />;
}

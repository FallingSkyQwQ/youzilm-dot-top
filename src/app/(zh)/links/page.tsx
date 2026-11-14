import type { Metadata } from "next";
import { LinksPage } from "@/views/links-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("zh", "links");

export default function Page() {
  return <LinksPage locale="zh" />;
}

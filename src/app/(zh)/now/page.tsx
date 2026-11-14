import type { Metadata } from "next";
import { NowPage } from "@/views/now-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("zh", "now");

export default function Page() {
  return <NowPage locale="zh" />;
}

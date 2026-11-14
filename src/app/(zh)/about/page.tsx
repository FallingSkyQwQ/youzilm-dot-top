import type { Metadata } from "next";
import { AboutPage } from "@/views/about-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("zh", "about");

export default function Page() {
  return <AboutPage locale="zh" />;
}

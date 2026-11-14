import type { Metadata } from "next";
import { ArchivePage } from "@/views/archive-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("en", "archive");

export default function Page() {
  return <ArchivePage locale="en" />;
}

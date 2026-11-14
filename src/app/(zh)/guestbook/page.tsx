import type { Metadata } from "next";
import { GuestbookPage } from "@/views/guestbook-page";
import { staticPageMetadata } from "@/lib/page-meta";

export const metadata: Metadata = staticPageMetadata("zh", "guestbook");

export default function Page() {
  return <GuestbookPage locale="zh" />;
}

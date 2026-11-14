import type { Metadata, Viewport } from "next";
import "@waline/client/waline.css";
import "katex/dist/katex.min.css";
import "@/styles/globals.css";
import { SiteShell } from "@/components/site-shell";
import { notoSerif } from "@/lib/fonts";
import { layoutMetadata } from "@/lib/metadata";
import { themeScript } from "@/lib/theme-script";

export const metadata: Metadata = layoutMetadata("zh");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0c" },
  ],
};

export default function ZhLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={notoSerif.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <SiteShell locale="zh">{children}</SiteShell>
      </body>
    </html>
  );
}

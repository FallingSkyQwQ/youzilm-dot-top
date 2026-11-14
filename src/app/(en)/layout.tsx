import type { Metadata, Viewport } from "next";
import "@waline/client/waline.css";
import "katex/dist/katex.min.css";
import "@/styles/globals.css";
import { SiteShell } from "@/components/site-shell";
import { notoSerif } from "@/lib/fonts";
import { layoutMetadata } from "@/lib/metadata";
import { themeScript } from "@/lib/theme-script";

export const metadata: Metadata = layoutMetadata("en");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0c" },
  ],
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={notoSerif.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <SiteShell locale="en">{children}</SiteShell>
      </body>
    </html>
  );
}

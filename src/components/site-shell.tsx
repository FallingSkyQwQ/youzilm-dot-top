import type { ReactNode } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { jsonLdString, websiteJsonLd } from "@/lib/jsonld";
import { PageTransition } from "./page-transition";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const d = getDict(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd(locale)) }}
      />
      <a className="skip-link" href="#main">
        {d.skipToContent}
      </a>
      <SiteHeader locale={locale} />
      <main id="main" className="site-main">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

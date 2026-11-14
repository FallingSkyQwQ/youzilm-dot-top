import Link from "next/link";
import { getDict, localePath, type Locale } from "@/lib/i18n";
import { HeaderClient } from "./header-client";

export function SiteHeader({ locale }: { locale: Locale }) {
  const d = getDict(locale);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href={localePath(locale, "/")} className="brand" aria-label={d.nav.home}>
          {d.siteName}
        </Link>
        <HeaderClient locale={locale} dict={d} />
      </div>
    </header>
  );
}

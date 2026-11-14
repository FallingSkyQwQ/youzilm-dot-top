import Link from "next/link";
import { getDict, localePath, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export function SiteFooter({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <hr />
      <div className="site-footer__inner">
        <div className="site-footer__box">
          <p>
            © {year} {locale === "zh" ? SITE.author : SITE.authorEn}
            <span aria-hidden="true"> · </span>
            <a href={SITE.licenseUrl} target="_blank" rel="noopener noreferrer">
              {SITE.license}
            </a>
            <span aria-hidden="true"> · </span>
            <Link href={localePath(locale, "/feed.xml")}>{d.footer.rss}</Link>
            <span aria-hidden="true"> · </span>
            <a href={SITE.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <span aria-hidden="true"> · </span>
            <a href={SITE.x} target="_blank" rel="noopener noreferrer">
              X
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

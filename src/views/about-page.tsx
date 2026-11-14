import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage, getStats } from "@/lib/content";
import { fill, formatDate, formatNumber } from "@/lib/format";
import { getDict, localePath, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export function AboutPage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const page = getPage(locale, "about");
  if (!page) notFound();
  const stats = getStats(locale);

  return (
    <div className="wrap about">
      <h1>{page.title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: page.html }} />

      <hr />

      <h2>{d.about.contact}</h2>
      <ul className="about-links">
        <li>
          <a href={SITE.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </li>
        <li>
          <a href={SITE.x} target="_blank" rel="noopener noreferrer">
            X
          </a>
        </li>
        <li>
          <Link href={localePath(locale, "/feed.xml")}>RSS</Link>
        </li>
      </ul>

      <h2>{d.about.info}</h2>
      <dl className="about-facts">
        <div>
          <dt>{d.about.site}</dt>
          <dd>
            <a href={SITE.url}>youzilm.top</a>
          </dd>
        </div>
        <div>
          <dt>{d.about.languages}</dt>
          <dd>{locale === "zh" ? "中文 / English" : "Chinese / English"}</dd>
        </div>
        <div>
          <dt>{d.about.license}</dt>
          <dd>
            <a href={SITE.licenseUrl} target="_blank" rel="noopener noreferrer">
              CC BY 4.0
            </a>
          </dd>
        </div>
        <div>
          <dt>{d.about.stack}</dt>
          <dd>Next.js · Cloudflare · D1 · Waline</dd>
        </div>
      </dl>

      <p className="about-updated">
        {fill(d.footer.updated, { date: formatDate(stats.lastUpdated) || "—" })}
        <span aria-hidden="true"> · </span>
        {fill(d.footer.words, { n: formatNumber(stats.totalWords, locale) })}
      </p>
    </div>
  );
}

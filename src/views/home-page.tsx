import Link from "next/link";
import { PostList } from "@/components/post-list";
import { getPosts, getStats } from "@/lib/content";
import { fill, formatDate, formatNumber } from "@/lib/format";
import { getDict, localePath, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export function HomePage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const posts = getPosts(locale);
  const stats = getStats(locale);

  return (
    <div className="wrap home">
      <h1 className="home-title">{d.siteName}</h1>
      <p className="home-tagline">
        <strong>{d.home.tagline}</strong>
      </p>
      <p>{d.home.bio}</p>

      <hr />

      <div className="home-columns">
        <section className="home-col">
          <h2>{d.home.recent}</h2>
          <PostList posts={posts.slice(0, 6)} locale={locale} />
          <p className="small">
            <Link href={localePath(locale, "/articles")}>{d.home.all}</Link>
            <span aria-hidden="true"> · </span>
            <Link href={localePath(locale, "/feed.xml")}>{d.posts.rss}</Link>
          </p>
        </section>

        <section className="home-col home-col--aside">
          <h2>{d.home.findMe}</h2>
          <ul className="plain-list">
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
              <Link href={localePath(locale, "/feed.xml")}>{d.posts.rss}</Link>
            </li>
            <li>
              <Link href={localePath(locale, "/about")}>{d.nav.about}</Link>
            </li>
          </ul>

          <h2>{d.nav.now}</h2>
          <p>
            {d.home.now} <Link href={localePath(locale, "/now")}>{d.home.nowLink}</Link>
          </p>

          <h2>{d.home.stats}</h2>
          <p className="small">
            {fill(d.footer.posts, { n: stats.totalPosts })}
            <span aria-hidden="true"> · </span>
            {fill(d.footer.words, { n: formatNumber(stats.totalWords, locale) })}
            {stats.lastUpdated ? (
              <>
                <span aria-hidden="true"> · </span>
                {fill(d.footer.updated, { date: formatDate(stats.lastUpdated) })}
              </>
            ) : null}
          </p>
        </section>
      </div>
    </div>
  );
}

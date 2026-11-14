import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleEnhancer } from "@/components/article-enhancer";
import { QuoteToComment } from "@/components/quote-to-comment";
import { ReadingProgress } from "@/components/reading-progress";
import { TagLinks } from "@/components/tag-links";
import { ArticleToc } from "@/components/article-toc";
import { ViewCounter } from "@/components/view-counter";
import { WalineComments } from "@/components/waline-comments";
import {
  getAdjacentPosts,
  getPost,
  getRelatedPosts,
  type LocalizedPost,
} from "@/lib/content";
import { fill, formatNumber, readingLabel } from "@/lib/format";
import { getDict, localePath, type Locale } from "@/lib/i18n";
import { blogPostingJsonLd, jsonLdString } from "@/lib/jsonld";
import { SITE } from "@/lib/site";

function PostNavLink({
  post,
  locale,
  label,
  direction,
}: {
  post: LocalizedPost;
  locale: Locale;
  label: string;
  direction: "prev" | "next";
}) {
  return (
    <Link
      href={localePath(locale, `/articles/${post.slug}`)}
      className={`post-nav__link post-nav__link--${direction}`}
    >
      <span className="post-nav__label">{label}</span>
      <span className="post-nav__title">{post.title}</span>
    </Link>
  );
}

export function ArticlePage({ locale, slug }: { locale: Locale; slug: string }) {
  const d = getDict(locale);
  const post = getPost(locale, slug);
  if (!post) notFound();

  const { previous, next } = getAdjacentPosts(locale, slug);
  const related = getRelatedPosts(locale, slug);
  // One canonical thread and one view counter for both language versions.
  const path = `/articles/${slug}`;
  const toc = post.toc;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(blogPostingJsonLd(post, locale)) }}
      />
      <ReadingProgress />

      <div className="article-layout">
        <article className="article">
        <header className="article-header">
          <h1 className="article-title">{post.title}</h1>
          <p className="article-meta">
            <time dateTime={post.date}>{post.date}</time>
            {post.updated ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>
                  {d.article.updated} {post.updated}
                </span>
              </>
            ) : null}
            <span aria-hidden="true"> · </span>
            <span>{readingLabel(post.minutes, locale)}</span>
            <span aria-hidden="true"> · </span>
            <span>{fill(d.article.words, { n: formatNumber(post.words, locale) })}</span>
            <span aria-hidden="true"> · </span>
            <ViewCounter path={path} label={d.article.views} locale={locale} />
          </p>
          <div className="article-tags">
            <TagLinks locale={locale} tags={post.tags} />
          </div>
          <hr />
        </header>

        {post.isFallback ? (
          <aside className="fallback-note">
            <strong>{d.article.fallbackTitle}</strong>{" "}
            {d.article.fallbackBody}{" "}
            <Link href={path}>{d.article.fallbackLink}</Link>
          </aside>
        ) : null}

        <div
          className="prose"
          lang={post.isFallback ? "zh-CN" : undefined}
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        <ArticleEnhancer
          copyLabel={d.article.copy}
          copiedLabel={d.article.copiedCode}
          zoomLabel={locale === "zh" ? "放大图片" : "Zoom image"}
          closeLabel={d.actions.close}
        />

        <footer className="article-footer">
          <hr />
          <p className="article-license">{d.article.license}</p>
          <div className="article-footer__row">
            <TagLinks locale={locale} tags={post.tags} className="tag-links--small" />
            <a className="back-to-top" href="#main">
              {d.article.backToTop} ↑
            </a>
          </div>
        </footer>

        {previous || next ? (
          <nav
            className={previous && next ? "post-nav" : "post-nav post-nav--single"}
            aria-label={d.article.nav}
          >
            {previous ? (
              <PostNavLink
                post={previous}
                locale={locale}
                label={d.article.prev}
                direction="prev"
              />
            ) : null}
            {next ? (
              <PostNavLink
                post={next}
                locale={locale}
                label={d.article.next}
                direction="next"
              />
            ) : null}
          </nav>
        ) : null}

        {related.length > 0 ? (
          <section className="related">
            <h2>{d.article.related}</h2>
            <ul className="related-list">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link href={localePath(locale, `/articles/${item.slug}`)}>
                    <time dateTime={item.date}>[{item.date}]</time>{" "}
                    <span>{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="comments" className="comments">
          <h2>{d.article.comments}</h2>
          <p className="comments__hint">{d.article.quoteHint}</p>
          <WalineComments
            path={path}
            locale={locale}
            loadingLabel={d.article.commentsLoading}
            errorLabel={d.article.commentsError}
            githubUrl={SITE.github}
          />
        </section>
        </article>

        <ArticleToc items={toc} label={d.article.toc} closeLabel={d.actions.close} />
      </div>

      <QuoteToComment
        label={d.article.quote}
        quoted={d.article.quoted}
        hint={d.article.quoteHint}
      />
    </>
  );
}

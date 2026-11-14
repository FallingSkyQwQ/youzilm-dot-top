import { PageHeader } from "@/components/page-header";
import { WalineComments } from "@/components/waline-comments";
import { getDict, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export function GuestbookPage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  // One guestbook thread shared by both languages.
  const path = "/guestbook";

  return (
    <div className="wrap wrap--narrow">
      <PageHeader title={d.guestbook.title} description={d.guestbook.intro} />

      <section id="comments" className="comments">
        <h2 className="comments__title">{d.article.comments}</h2>
        <WalineComments
          path={path}
          locale={locale}
          loadingLabel={d.article.commentsLoading}
          errorLabel={d.article.commentsError}
          githubUrl={SITE.github}
        />
      </section>
    </div>
  );
}

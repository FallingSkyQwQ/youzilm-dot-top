import { PageHeader } from "@/components/page-header";
import { getLinks } from "@/lib/content";
import { getDict, type Locale } from "@/lib/i18n";
import { SITE } from "@/lib/site";

export function LinksPage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const { friends, elsewhere } = getLinks(locale);

  return (
    <div className="wrap wrap--narrow">
      <PageHeader title={d.links.title} description={d.links.intro} />

      <section className="link-section">
        <h2 className="section-title">{d.links.friends}</h2>
        {friends.length === 0 ? (
          <p className="empty-note">
            {locale === "zh" ? "通过 " : "Find me on "}
            <a href={SITE.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            {locale === "zh" ? " 或 " : " or "}
            <a href={SITE.x} target="_blank" rel="noopener noreferrer">
              X
            </a>
            {locale === "zh" ? " 告诉我。" : "."}
          </p>
        ) : (
          <ul className="link-list">
            {friends.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <span className="link-list__name">{link.name}</span>
                  <span className="link-list__description">{link.description}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="link-section">
        <h2 className="section-title">{d.links.elsewhere}</h2>
        <ul className="link-list">
          {elsewhere.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <span className="link-list__name">
                  {link.name} <span aria-hidden="true">↗</span>
                </span>
                <span className="link-list__description">{link.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

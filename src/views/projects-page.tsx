import { PageHeader } from "@/components/page-header";
import { getProjects } from "@/lib/content";
import { getDict, type Locale } from "@/lib/i18n";

export function ProjectsPage({ locale }: { locale: Locale }) {
  const d = getDict(locale);
  const projects = getProjects(locale);

  return (
    <div className="wrap wrap--narrow">
      <PageHeader title={d.projects.title} description={d.projects.intro} />

      {projects.length === 0 ? (
        <p className="empty-note">{d.projects.empty}</p>
      ) : (
        <ol className="project-list">
          {projects.map((project) => (
            <li className="project-item" key={project.slug}>
              <div className="project-item__meta">
                <span>{project.year}</span>
                <span>{project.tech.join(" · ")}</span>
              </div>
              <h2 className="project-item__title">{project.title}</h2>
              <p className="project-item__description">{project.description}</p>
              {project.links.length > 0 ? (
                <ul className="project-links">
                  {project.links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

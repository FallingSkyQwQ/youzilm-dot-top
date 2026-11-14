"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  localePath,
  stripLocale,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";
import { LangSwitch } from "./lang-switch";
import { SearchDialog } from "./search-dialog";
import { ThemeToggle } from "./theme-toggle";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function HeaderClient({ locale, dict }: Props) {
  const pathname = usePathname() || "/";
  const stripped = stripLocale(pathname);
  const [searchPath, setSearchPath] = useState<string | null>(null);
  const searchOpen = searchPath === pathname;

  const nav = [
    { key: "articles", href: localePath(locale, "/articles"), match: "/articles" },
    { key: "archive", href: localePath(locale, "/archive"), match: "/archive" },
    { key: "tags", href: localePath(locale, "/tags"), match: "/tags" },
    { key: "projects", href: localePath(locale, "/projects"), match: "/projects" },
    { key: "guestbook", href: localePath(locale, "/guestbook"), match: "/guestbook" },
    { key: "links", href: localePath(locale, "/links"), match: "/links" },
    { key: "now", href: localePath(locale, "/now"), match: "/now" },
    { key: "about", href: localePath(locale, "/about"), match: "/about" },
  ] as const;

  function isActive(match: string) {
    return stripped === match || stripped.startsWith(`${match}/`);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchPath(pathname);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname]);

  const searchLabels = { ...dict.search, fallback: dict.posts.fallback };

  return (
    <>
      <nav className="site-nav" aria-label={dict.navLabel}>
        {nav.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={isActive(item.match) ? "site-nav__link is-active" : "site-nav__link"}
            aria-current={isActive(item.match) ? "page" : undefined}
          >
            {dict.nav[item.key]}
          </Link>
        ))}
      </nav>

      <div className="site-actions">
        <button
          type="button"
          className="plain-button"
          onClick={() => setSearchPath(pathname)}
          aria-label={dict.actions.openSearch}
          aria-haspopup="dialog"
          title={dict.search.shortcut}
        >
          {dict.actions.search}
        </button>
        <span className="action-sep" aria-hidden="true">
          |
        </span>
        <LangSwitch
          locale={locale}
          label={dict.actions.language}
          text={dict.actions.languageShort}
        />
        <span className="action-sep" aria-hidden="true">
          |
        </span>
        <ThemeToggle
          label={dict.actions.theme}
          toLight={dict.actions.themeToLight}
          toDark={dict.actions.themeToDark}
          textLight={dict.theme.light}
          textDark={dict.theme.dark}
        />
      </div>

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchPath(null)}
        locale={locale}
        labels={searchLabels}
      />
    </>
  );
}

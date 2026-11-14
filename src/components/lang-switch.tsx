"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { otherLocaleHref, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  label: string;
  text: string;
};

export function LangSwitch({ locale, label, text }: Props) {
  const pathname = usePathname() || "/";
  const href = otherLocaleHref(locale, pathname);

  return (
    <Link
      href={href}
      hrefLang={locale === "zh" ? "en" : "zh-CN"}
      className="lang-switch"
      aria-label={label}
      title={label}
    >
      {text}
    </Link>
  );
}

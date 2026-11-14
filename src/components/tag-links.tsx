import Link from "next/link";
import { getTag } from "@/lib/content";
import { localePath, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/format";

type Props = {
  locale: Locale;
  tags: string[];
  className?: string;
};

export function TagLinks({ locale, tags, className }: Props) {
  if (!tags.length) return null;

  return (
    <ul className={cn("tag-links", className)} aria-label={locale === "zh" ? "标签" : "Tags"}>
      {tags.map((key) => {
        const tag = getTag(locale, key);
        return (
          <li key={key}>
            <Link href={localePath(locale, `/tags/${key}`)}>#{tag?.label ?? key}</Link>
          </li>
        );
      })}
    </ul>
  );
}

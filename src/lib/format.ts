import type { Locale } from "./i18n";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US").format(value);
}

export function formatDate(date: string | null | undefined): string {
  return date ? date.slice(0, 10) : "";
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

export function readingLabel(minutes: number, locale: Locale): string {
  return locale === "zh" ? `约 ${minutes} 分钟` : `≈ ${minutes} min read`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

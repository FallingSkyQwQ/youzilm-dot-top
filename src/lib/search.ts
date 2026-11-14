import MiniSearch from "minisearch";
import type { Locale } from "./i18n";

export type SearchRecord = {
  id: string;
  kind: "post" | "page";
  lang: Locale;
  sourceLang: Locale;
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  content: string;
  url: string;
};

type SearchPayload = {
  generatedAt: string;
  records: SearchRecord[];
};

export type SearchEngine = {
  recordsByLocale: Record<Locale, SearchRecord[]>;
  indexes: Record<Locale, MiniSearch<SearchRecord>>;
  byId: Map<string, SearchRecord>;
};

export type SearchTextPart = { text: string; matched: boolean };

function queryTerms(query: string): string[] {
  return [...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
}

// Return text segments so React can escape content, including literal HTML.
export function highlightSearchText(text: string, query: string): SearchTextPart[] {
  const terms = queryTerms(query);
  if (!terms.length) return [{ text, matched: false }];
  const lower = text.toLowerCase();
  const parts: SearchTextPart[] = [];
  let start = 0;
  for (let cursor = 0; cursor < text.length;) {
    const term = terms.find(value => lower.startsWith(value, cursor));
    if (!term) { cursor++; continue; }
    if (cursor > start) parts.push({ text: text.slice(start, cursor), matched: false });
    parts.push({ text: text.slice(cursor, cursor + term.length), matched: true });
    cursor += term.length;
    start = cursor;
  }
  if (start < text.length) parts.push({ text: text.slice(start), matched: false });
  return parts;
}

export function searchExcerpt(record: SearchRecord, query: string, length = 160): string {
  const summary = record.summary.replace(/\s+/g, " ").trim();
  const content = record.content.replace(/\s+/g, " ").trim();
  const terms = queryTerms(query);
  const matchAt = (text: string) => {
    const positions = terms.map(term => text.toLowerCase().indexOf(term)).filter(index => index >= 0);
    return positions.length ? Math.min(...positions) : -1;
  };
  const text = matchAt(summary) >= 0 ? summary : matchAt(content) >= 0 ? content : summary || content;
  const match = matchAt(text);
  const start = Math.max(0, Math.min(match - 45, text.length - length));
  const end = Math.min(text.length, start + length);
  return (start ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function tokenize(text: string): string[] {
  const value = text.toLowerCase();
  if (!value) return [];

  try {
    const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
    const tokens: string[] = [];
    for (const segment of segmenter.segment(value)) {
      if (segment.isWordLike) tokens.push(segment.segment);
    }
    return tokens.length > 0
      ? tokens
      : value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  } catch {
    return value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }
}

function createIndex(records: SearchRecord[]): MiniSearch<SearchRecord> {
  const index = new MiniSearch<SearchRecord>({
    idField: "id",
    fields: ["title", "summary", "tags", "content"],
    storeFields: ["title", "summary", "date", "url", "lang", "sourceLang", "kind", "tags", "slug"],
    tokenize,
    processTerm: (term) => term.toLowerCase(),
  });
  index.addAll(records);
  return index;
}

export function buildSearchEngine(payload: SearchPayload): SearchEngine {
  const recordsByLocale: Record<Locale, SearchRecord[]> = { zh: [], en: [] };
  const byId = new Map<string, SearchRecord>();

  for (const record of payload.records) {
    if (record.lang !== "zh" && record.lang !== "en") continue;
    recordsByLocale[record.lang].push(record);
    byId.set(record.id, record);
  }

  return {
    recordsByLocale,
    indexes: {
      zh: createIndex(recordsByLocale.zh),
      en: createIndex(recordsByLocale.en),
    },
    byId,
  };
}

let cached: Promise<SearchEngine> | null = null;

export function loadSearchIndex(): Promise<SearchEngine> {
  if (!cached) {
    cached = fetch("/search-index.json", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`search index: ${response.status}`);
        return (await response.json()) as SearchPayload;
      })
      .then(buildSearchEngine)
      .catch((error) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}

function haystack(record: SearchRecord): string {
  return `${record.title} ${record.summary} ${record.tags.join(" ")} ${record.content}`.toLowerCase();
}

export function searchRecords(
  engine: SearchEngine,
  locale: Locale,
  query: string,
  limit = 20,
): SearchRecord[] {
  const value = query.trim();
  if (!value) return [];

  const results = engine.indexes[locale].search(value, {
    prefix: true,
    fuzzy: 0.2,
    combineWith: "AND",
    boost: { title: 4, summary: 2, tags: 2 },
  });

  const matched: SearchRecord[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const record = engine.byId.get(String(result.id));
    if (!record || seen.has(record.id)) continue;
    matched.push(record);
    seen.add(record.id);
  }

  // MiniSearch's tokenizer is good at words, but a Chinese phrase can still
  // miss when the indexed text was segmented differently. Fall back to a
  // simple substring match for CJK queries.
  if (/[\u3400-\u9fff]/.test(value)) {
    const terms = value.split(/\s+/).filter(Boolean).map((term) => term.toLowerCase());
    for (const record of engine.recordsByLocale[locale]) {
      if (seen.has(record.id)) continue;
      const text = haystack(record);
      if (terms.every((term) => text.includes(term))) {
        matched.push(record);
        seen.add(record.id);
      }
    }
  }

  return matched.slice(0, limit);
}

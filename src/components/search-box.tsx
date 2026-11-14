"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useDeferredValue,
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  loadSearchIndex,
  searchRecords,
  searchExcerpt,
  highlightSearchText,
  type SearchEngine,
  type SearchRecord,
} from "@/lib/search";
import type { Locale, SearchLabels as Labels } from "@/lib/i18n";
import { CloseIcon, SearchIcon } from "./icons";

type Props = {
  locale: Locale;
  labels: Labels;
  initialQuery?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  onQueryChange?: (query: string) => void;
  onEscape?: () => void;
};

function resultMeta(record: SearchRecord, labels: Labels): string {
  if (record.kind === "page") return labels.page;
  return record.date || labels.post;
}

function Highlight({ text, query }: { text: string; query: string }) {
  return highlightSearchText(text, query).map((part, index) =>
    part.matched ? <mark key={index}>{part.text}</mark> : part.text,
  );
}

export function SearchBox({
  locale,
  labels,
  initialQuery = "",
  autoFocus = false,
  onNavigate,
  onQueryChange,
  onEscape,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const resultId = useId();
  const [engine, setEngine] = useState<SearchEngine | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let alive = true;
    loadSearchIndex()
      .then((value) => {
        if (!alive) return;
        setEngine(value);
        setStatus("ready");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (autoFocus) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
  }, [autoFocus]);

  const results = useMemo(() => {
    if (!engine) return [];
    return searchRecords(engine, locale, deferredQuery);
  }, [engine, locale, deferredQuery]);

  const selectedIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    bodyRef.current?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, results]);

  function updateQuery(value: string) {
    setQuery(value);
    setActive(0);
    onQueryChange?.(value);
  }

  function choose(index: number) {
    const result = results[index];
    if (!result) return;
    onNavigate?.();
    router.push(result.url);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(selectedIndex);
      return;
    }
    if (event.key === "Escape") {
      if (onEscape) {
        event.preventDefault();
        onEscape();
      }
      return;
    }
  }

  const showResults = status === "ready" && query.trim().length > 0;

  return (
    <div className="search-box">
      <div className="search-box__field">
        <SearchIcon className="search-box__icon" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          role="combobox"
          aria-expanded={showResults && results.length > 0}
          aria-controls={`${resultId}-results`}
          aria-autocomplete="list"
          aria-activedescendant={
            showResults && results.length > 0 ? `${resultId}-${selectedIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          type="search"
        />
        {query ? (
          <button
            type="button"
            className="search-box__clear"
            onClick={() => {
              updateQuery("");
              inputRef.current?.focus();
            }}
            aria-label={labels.clear}
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <div className="search-box__body" ref={bodyRef}>
        {status === "loading" ? (
          <p className="search-empty">{labels.loading}</p>
        ) : null}
        {status === "error" ? (
          <p className="search-empty search-empty--error">{labels.error}</p>
        ) : null}
        {status === "ready" && !query.trim() ? (
          <p className="search-empty">
            {labels.hint} <span className="search-empty__hint">{labels.empty}</span>
          </p>
        ) : null}
        {showResults && results.length === 0 ? (
          <p className="search-empty">{labels.noResults}</p>
        ) : null}

        {showResults && results.length > 0 ? (
          <ul className="search-results" id={`${resultId}-results`} role="listbox" aria-busy={query !== deferredQuery}>
            {results.map((result, index) => (
              <li key={result.id} role="presentation">
                <Link
                  href={result.url}
                  id={`${resultId}-${index}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={index === selectedIndex ? "search-result is-active" : "search-result"}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => onNavigate?.()}
                >
                  <span className="search-result__meta">
                    <span>{resultMeta(result, labels)}</span>
                    {result.sourceLang !== result.lang ? (
                      <span className="search-result__lang">{labels.fallback}</span>
                    ) : null}
                  </span>
                  <span className="search-result__title"><Highlight text={result.title} query={deferredQuery} /></span>
                  <span className="search-result__summary"><Highlight text={searchExcerpt(result, deferredQuery)} query={deferredQuery} /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="search-box__footer">
        <span>{labels.hint}</span>
        <span className="search-box__keys">{labels.navHint}</span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { injectQuote, takePendingQuote } from "@/lib/quote";
import { SITE } from "@/lib/site";

type Props = {
  path: string;
  locale: Locale;
  loadingLabel: string;
  errorLabel: string;
  githubUrl: string;
};

export function WalineComments({
  path,
  locale,
  loadingLabel,
  errorLabel,
  githubUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    let instance: { destroy: () => void } | null = null;

    import("@waline/client")
      .then(({ init }) => {
        if (!alive || !containerRef.current) return;
        instance = init({
          el: containerRef.current,
          serverURL: SITE.walineUrl,
          path,
          lang: locale === "zh" ? "zh-CN" : "en",
          login: "disable",
          meta: ["nick", "mail", "link"],
          requiredMeta: ["nick"],
          pageSize: 20,
          commentSorting: "latest",
          reaction: false,
          emoji: false,
          search: false,
          imageUploader: false,
          dark: false,
          noCopyright: false,
        });

        if (!instance) {
          setStatus("error");
          return;
        }

        setStatus("ready");

        const pending = takePendingQuote();
        if (pending) {
          let tries = 0;
          const attempt = () => {
            if (!alive) return;
            if (injectQuote(pending)) return;
            if (tries++ < 10) window.setTimeout(attempt, 300);
          };
          window.setTimeout(attempt, 400);
        }
      })
      .catch(() => {
        if (alive) setStatus("error");
      });

    return () => {
      alive = false;
      instance?.destroy();
    };
  }, [path, locale]);

  return (
    <div className="comments-mount">
      {status !== "ready" ? (
        <p className={status === "error" ? "comments-note comments-note--error" : "comments-note"}>
          {status === "error" ? (
            <>
              {errorLabel}{" "}
              <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </>
          ) : (
            loadingLabel
          )}
        </p>
      ) : null}
      <div id="waline" ref={containerRef} />
    </div>
  );
}

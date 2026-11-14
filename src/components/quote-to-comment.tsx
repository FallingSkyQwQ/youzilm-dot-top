"use client";

import { useEffect, useRef, useState } from "react";
import { injectQuote, storePendingQuote } from "@/lib/quote";
import { QuoteIcon } from "./icons";

type ButtonState = {
  text: string;
  top: number;
  left: number;
  below: boolean;
};

type Props = {
  label: string;
  quoted: string;
  hint: string;
};

export function QuoteToComment({ label, quoted, hint }: Props) {
  const [button, setButton] = useState<ButtonState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    let timer: number | null = null;

    function hide() {
      setButton(null);
    }

    function update() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        hide();
        return;
      }

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element =
        container.nodeType === Node.ELEMENT_NODE
          ? (container as Element)
          : container.parentElement;
      if (!element?.closest(".prose")) {
        hide();
        return;
      }

      const text = selection.toString().replace(/\s+/g, " ").trim();
      if (text.length < 2 || text.length > 800) {
        hide();
        return;
      }

      const rect =
        range.getBoundingClientRect().width > 0
          ? range.getBoundingClientRect()
          : range.getClientRects()[0];
      if (!rect) {
        hide();
        return;
      }

      const below = rect.top < 90;
      const left = Math.min(Math.max(rect.left + rect.width / 2, 88), window.innerWidth - 88);

      setButton({
        text,
        left,
        top: below ? rect.bottom + 10 : rect.top - 10,
        below,
      });
    }

    function schedule() {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(update, 80);
    }

    function onScroll() {
      hide();
    }

    document.addEventListener("mouseup", schedule);
    document.addEventListener("keyup", schedule);
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("mouseup", schedule);
      document.removeEventListener("keyup", schedule);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  function onQuote() {
    if (!button) return;

    const quote = `> ${button.text}\n\n`;
    if (!injectQuote(quote)) storePendingQuote(quote);

    document.getElementById("comments")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setButton(null);
    window.getSelection()?.removeAllRanges();

    setToast(quoted);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  return (
    <>
      {button ? (
        <button
          type="button"
          className={button.below ? "quote-button quote-button--below" : "quote-button"}
          style={{ top: button.top, left: button.left }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onQuote}
          title={hint}
        >
          <QuoteIcon /> {label}
        </button>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}

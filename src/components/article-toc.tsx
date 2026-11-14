"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { TocItem } from "@/lib/content";
import { readingProgress } from "@/lib/reading-progress";

type Props = { items: TocItem[]; label: string; closeLabel: string };
const CIRCUMFERENCE = 2 * Math.PI * 19;

function TocList({ items, listRef, onNavigate }: {
  items: TocItem[]; listRef: RefObject<HTMLUListElement | null>; onNavigate?: () => void;
}) {
  return <ul className="toc__list" ref={listRef}>
    {items.map(item => <li key={item.id} className={`toc__item toc__item--h${item.depth}`}>
      <a href={`#${item.id}`} onClick={onNavigate}>{item.text}</a>
    </li>)}
  </ul>;
}

export function ArticleToc({ items, label, closeLabel }: Props) {
  const [open, setOpen] = useState(false);
  const asideListRef = useRef<HTMLUListElement>(null);
  const panelListRef = useRef<HTMLUListElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const panelRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;
    panel.showModal();
    return () => panel.close();
  }, [open]);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const list = asideListRef.current;
      const prose = document.querySelector(".article .prose");
      if (!list || !prose || !items.length) return;
      const links = Array.from(list.querySelectorAll<HTMLAnchorElement>("a"));
      const panelLinks = Array.from(panelListRef.current?.querySelectorAll<HTMLAnchorElement>("a") || []);
      const headings = items.map(item => document.getElementById(item.id));
      const offset = 96;
      let current = 0;
      for (let i = 0; i < headings.length; i++) {
        if (headings[i] && headings[i]!.getBoundingClientRect().top <= offset) current = i;
        else break;
      }
      const currentTop = headings[current]?.getBoundingClientRect().top || 0;
      const nextTop = headings[current + 1]?.getBoundingClientRect().top;
      const t = nextTop !== undefined && nextTop > currentTop
        ? Math.min(1, Math.max(0, (offset - currentTop) / (nextTop - currentTop))) : 0;
      const rect = list.getBoundingClientRect();
      if (rect.height > 0 && links.length) {
        const centers = links.map(link => {
          const r = link.getBoundingClientRect();
          return r.top - rect.top + r.height / 2;
        });
        const dot = centers[current] + ((centers[current + 1] ?? centers[current]) - centers[current]) * t;
        if (dotRef.current) dotRef.current.style.top = `${dot}px`;
        if (progressRef.current) {
          progressRef.current.style.top = `${centers[0]}px`;
          progressRef.current.style.height = `${Math.max(0, dot - centers[0])}px`;
        }
      }
      const body = prose.getBoundingClientRect();
      const overall = readingProgress(body.top, body.height, window.innerHeight);
      if (ringRef.current) ringRef.current.style.strokeDashoffset = `${CIRCUMFERENCE * (1 - overall)}`;
      for (const elements of [links, panelLinks]) {
        elements.forEach((link, index) => {
          link.classList.toggle("is-current", index === current);
          link.classList.toggle("is-next", index === current + 1);
          if (index === current) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }
    }
    function onScroll() { if (!frame) frame = requestAnimationFrame(update); }
    update();
    const resizeObserver = new ResizeObserver(onScroll);
    const prose = document.querySelector(".article .prose");
    if (prose) resizeObserver.observe(prose);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items, open]);

  if (!items.length) return null;
  return <>
    <aside className="article-aside">
      <nav className="toc" aria-label={label}>
        <p className="toc__title">{label}</p>
        <div className="toc__body">
          <span className="toc__progress" ref={progressRef} aria-hidden="true" />
          <span className="toc__dot" ref={dotRef} aria-hidden="true" />
          <TocList items={items} listRef={asideListRef} />
        </div>
      </nav>
    </aside>
    <button ref={buttonRef} type="button" className={open ? "toc-ring is-open" : "toc-ring"}
      onClick={() => setOpen(true)} aria-label={label} aria-haspopup="dialog" aria-expanded={open}
      aria-controls="article-toc-panel" title={label}>
      <svg className="toc-ring__ring" viewBox="0 0 46 46" aria-hidden="true">
        <circle className="toc-ring__track" cx="23" cy="23" r="19" />
        <circle ref={ringRef} className="toc-ring__progress" cx="23" cy="23" r="19"
          style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: CIRCUMFERENCE }} />
      </svg>
      <span className="toc-ring__label" aria-hidden="true">≡</span>
    </button>
    <dialog ref={panelRef} id="article-toc-panel" className="toc-panel" aria-label={label}
      onCancel={(event) => { event.preventDefault(); setOpen(false); }}>
      <div className="toc-panel__head">
        <p className="toc__title">{label}</p>
        <button type="button" className="toc-panel__close" onClick={() => setOpen(false)}
          aria-label={closeLabel}>×</button>
      </div>
      <TocList items={items} listRef={panelListRef} onNavigate={() => setOpen(false)} />
    </dialog>
  </>;
}

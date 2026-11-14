"use client";

import { useEffect, useRef } from "react";
import { readingProgress } from "@/lib/reading-progress";

export function ReadingProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;

    function update() {
      frame = 0;
      const prose = document.querySelector(".article .prose");
      if (!prose) return;
      const rect = prose.getBoundingClientRect();
      const progress = readingProgress(rect.top, rect.height, window.innerHeight);
      if (ref.current) ref.current.style.transform = `scaleX(${progress})`;
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    update();
    const observer = new ResizeObserver(onScroll);
    const prose = document.querySelector(".article .prose");
    if (prose) observer.observe(prose);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="reading-progress" aria-hidden="true">
      <div className="reading-progress__bar" ref={ref} />
    </div>
  );
}

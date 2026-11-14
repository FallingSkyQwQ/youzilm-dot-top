"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "./icons";

type Zoom = { src: string; alt: string };

type Props = {
  copyLabel: string;
  copiedLabel: string;
  zoomLabel: string;
  closeLabel: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the old selection method.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function ArticleEnhancer({
  copyLabel,
  copiedLabel,
  zoomLabel,
  closeLabel,
}: Props) {
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [zoomClosing, setZoomClosing] = useState(false);
  const zoomTimer = useRef<number | null>(null);
  const zoomRef = useRef<HTMLDialogElement>(null);

  const openZoom = useCallback((value: Zoom) => {
    if (zoomTimer.current) {
      window.clearTimeout(zoomTimer.current);
      zoomTimer.current = null;
    }
    setZoom(value);
    setZoomClosing(false);
  }, []);

  const closeZoom = useCallback(() => {
    if (!zoom || zoomTimer.current) return;
    setZoomClosing(true);
    zoomTimer.current = window.setTimeout(() => {
      setZoom(null);
      setZoomClosing(false);
      zoomTimer.current = null;
    }, 150);
  }, [zoom]);

  useEffect(() => {
    return () => {
      if (zoomTimer.current) window.clearTimeout(zoomTimer.current);
    };
  }, []);

  useEffect(() => {
    async function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target) return;

      const button = target.closest<HTMLButtonElement>("[data-code-copy]");
      if (button) {
        const figure = button.closest(".md-code");
        const code = figure?.querySelector("pre code");
        if (!code) return;
        const ok = await copyText(code.textContent || "");
        if (!ok) return;

        const copied = button.dataset.copiedLabel || copiedLabel;
        button.textContent = copied;
        button.classList.add("is-copied");
        window.setTimeout(() => {
          button.textContent = copyLabel;
          button.classList.remove("is-copied");
        }, 1600);
        return;
      }

      const image = target.closest<HTMLImageElement>(".prose img[data-zoomable]");
      if (image) {
        openZoom({ src: image.currentSrc || image.src, alt: image.alt || "" });
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target as Element | null;
      const image = target?.closest<HTMLImageElement>(".prose img[data-zoomable]");
      if (!image) return;
      event.preventDefault();
      openZoom({ src: image.currentSrc || image.src, alt: image.alt || "" });
    }

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);

    const images = document.querySelectorAll<HTMLImageElement>(".prose img[data-zoomable]");
    for (const image of images) {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      if (!image.getAttribute("aria-label")) image.setAttribute("aria-label", zoomLabel);
    }

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [copyLabel, copiedLabel, zoomLabel, openZoom, closeZoom]);

  useEffect(() => {
    if (!zoom) return;
    const dialog = zoomRef.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, [zoom]);

  if (!zoom) return null;

  return (
    <dialog
      ref={zoomRef}
      className={zoomClosing ? "image-zoom is-closing" : "image-zoom"}
      role="dialog"
      aria-modal="true"
      aria-label={zoom.alt || zoomLabel}
      onCancel={(event) => { event.preventDefault(); closeZoom(); }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeZoom();
      }}
    >
      <button
        type="button"
        className="icon-button image-zoom__close"
        onClick={closeZoom}
        aria-label={closeLabel}
        title={closeLabel}
      >
        <CloseIcon />
      </button>
      {/* Full-size zoom uses the original URL, including remote images. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={zoom.src} alt={zoom.alt} />
    </dialog>
  );
}

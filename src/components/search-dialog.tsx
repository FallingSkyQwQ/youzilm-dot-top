"use client";

import { useEffect, useRef } from "react";
import type { Locale, SearchLabels as Labels } from "@/lib/i18n";
import { SearchBox } from "./search-box";
import { CloseIcon } from "./icons";

type Props = { open: boolean; onClose: () => void; locale: Locale; labels: Labels };

export function SearchDialog({ open, onClose, locale, labels }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, [open]);

  return (
    <dialog ref={ref} className="search-overlay" aria-label={labels.title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {open ? <div className="search-dialog">
        <div className="search-dialog__top">
          <span className="search-dialog__label">{labels.title}</span>
          <button type="button" className="icon-button" onClick={onClose}
            aria-label={labels.close} title={labels.close}><CloseIcon /></button>
        </div>
        <SearchBox locale={locale} labels={labels} autoFocus onNavigate={onClose} onEscape={onClose} />
      </div> : null}
    </dialog>
  );
}

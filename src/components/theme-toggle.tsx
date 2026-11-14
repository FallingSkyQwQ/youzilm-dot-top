"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

type Props = {
  label: string;
  toLight: string;
  toDark: string;
  textLight: string;
  textDark: string;
};

export function ThemeToggle({ label, toLight, toDark, textLight, textDark }: Props) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.dataset.theme = next;
    root.style.colorScheme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode can block storage; the theme still applies for this page.
    }
  }

  const isDark = theme === "dark";
  const aria = theme ? (isDark ? toLight : toDark) : label;

  return (
    <button type="button" className="plain-button" onClick={toggle} aria-label={aria} title={aria}>
      {isDark ? textLight : textDark}
    </button>
  );
}

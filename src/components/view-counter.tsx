"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";

type Props = {
  path: string;
  label: string;
  locale: Locale;
};

type ViewResponse = { count?: number; enabled?: boolean };

// React StrictMode runs effects twice in development. Sharing the in-flight
// request prevents a double increment and keeps both mounts in sync.
const requests = new Map<string, Promise<ViewResponse>>();

function requestView(path: string, increment: boolean): Promise<ViewResponse> {
  const key = `${increment ? "inc" : "get"}:${path}`;
  const existing = requests.get(key);
  if (existing) return existing;

  const request = increment
    ? fetch("/api/views", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ path }),
      })
    : fetch(`/api/views?path=${encodeURIComponent(path)}`, {
        headers: { accept: "application/json" },
      });

  const promise = request
    .then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as ViewResponse;
    })
    .catch((error) => {
      requests.delete(key);
      throw error;
    });

  requests.set(key, promise);
  return promise;
}

export function ViewCounter({ path, label, locale }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let alive = true;
    const storageKey = `viewed:${path}`;
    let viewed = false;

    try {
      viewed = sessionStorage.getItem(storageKey) === "1";
    } catch {
      // Storage can be blocked; still show the count.
    }

    requestView(path, !viewed)
      .then((data) => {
        if (!alive) return;
        if (data.enabled === false) {
          setVisible(false);
          return;
        }
        if (typeof data.count === "number") setCount(data.count);
        if (!viewed) {
          try {
            sessionStorage.setItem(storageKey, "1");
          } catch {
            // Ignore storage failures.
          }
        }
      })
      .catch(() => {
        if (alive) setVisible(false);
      });

    return () => {
      alive = false;
    };
  }, [path]);

  if (!visible) return null;

  return (
    <span className="view-counter">
      {label} {count === null ? "—" : formatNumber(count, locale)}
    </span>
  );
}

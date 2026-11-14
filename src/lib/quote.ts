export function injectQuote(quote: string): boolean {
  if (typeof document === "undefined") return false;

  const textarea = document.querySelector<HTMLTextAreaElement>("#waline textarea");
  if (textarea) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    const next = quote + textarea.value;
    if (setter) setter.call(textarea, next);
    else textarea.value = next;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus({ preventScroll: true });
    try {
      textarea.setSelectionRange(quote.length, quote.length);
    } catch {
      // Some browsers refuse selection on a hidden or detached field.
    }
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  const editable = document.querySelector<HTMLElement>('#waline [contenteditable="true"]');
  if (editable) {
    editable.textContent = quote + (editable.textContent || "");
    editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
    editable.focus({ preventScroll: true });
    editable.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  return false;
}

export function storePendingQuote(quote: string): void {
  try {
    sessionStorage.setItem("pending-quote", quote);
  } catch {
    // Storage can be unavailable; the user can still paste the quote.
  }
}

export function takePendingQuote(): string | null {
  try {
    const quote = sessionStorage.getItem("pending-quote");
    if (quote) sessionStorage.removeItem("pending-quote");
    return quote;
  } catch {
    return null;
  }
}

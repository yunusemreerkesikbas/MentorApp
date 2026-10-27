"use client";
import { useEffect, useState } from "react";

/** Advertising ends for the visit when reading turns into a personal interaction. */
export function useCommunityAdSuppression() {
  const [suppressed, setSuppressed] = useState(false);
  useEffect(() => {
    const editing = (target: Element | null) => target?.matches('input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
    const stop = () => setSuppressed(true);
    const focus = (event: FocusEvent) => { if (event.target instanceof Element && editing(event.target)) stop(); };
    const checkDialog = () => {
      if ([...document.querySelectorAll('[role="dialog"], dialog[open]')]
        .some((dialog) => !dialog.closest('[aria-hidden="true"], [inert], [hidden]') && dialog.getClientRects().length > 0)) stop();
    };
    if (editing(document.activeElement)) stop();
    checkDialog();
    document.addEventListener("focusin", focus, true);
    window.addEventListener("community:zones-changed", stop);
    const observer = new MutationObserver(checkDialog);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "role", "aria-hidden", "inert", "hidden"] });
    return () => {
      document.removeEventListener("focusin", focus, true);
      window.removeEventListener("community:zones-changed", stop);
      observer.disconnect();
    };
  }, []);
  return suppressed;
}

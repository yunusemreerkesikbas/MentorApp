"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * The page reserves a stable scrollbar gutter (`html { scrollbar-gutter: stable }`). With classic
 * scrollbars (Windows, Linux) Chrome paints it white and no fixed layer can cover it, so a
 * full-screen night would stop a strip short of the right edge. While the scene is up the gutter
 * goes, and the body takes its width as padding: the page content does not move.
 */
function releaseGutter(dialog: HTMLElement | null): () => void {
  const html = document.documentElement;
  const width = dialog ? window.innerWidth - dialog.getBoundingClientRect().width : 0;
  if (width < 1) return () => undefined;
  const previous = { gutter: html.style.scrollbarGutter, padding: document.body.style.paddingRight };
  const padding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
  html.style.scrollbarGutter = "auto";
  document.body.style.paddingRight = `${padding + width}px`;
  return () => {
    html.style.scrollbarGutter = previous.gutter;
    document.body.style.paddingRight = previous.padding;
  };
}

/**
 * Dialog plumbing, the same contract as the journey spotlight: body scroll lock, a Tab trap,
 * Escape to close (swallowed while a close request is in flight, so the request and the UI stay in
 * step) and focus handed back to whatever was focused before the scene opened.
 */
export function useCelebrationDialog(
  dialogRef: RefObject<HTMLElement | null>,
  { busy, onEscape }: { busy: boolean; onEscape: () => void },
): void {
  const busyRef = useRef(busy);
  const escapeRef = useRef(onEscape);

  useEffect(() => {
    busyRef.current = busy;
    escapeRef.current = onEscape;
  }, [busy, onEscape]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreGutter = releaseGutter(dialogRef.current);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (busyRef.current) return;
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      // `inert` parts of the scene (the CTA before it is ready) are not focusable targets.
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (node) => !node.closest("[inert]"),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreGutter();
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus();
      });
    };
  }, [dialogRef]);
}

"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tabbable controls inside the dialog that are actually rendered (a `hidden` branch is skipped). */
function tabbables(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.getClientRects().length > 0,
  );
}

interface DialogFocusOptions {
  /** The dialog element. Tab never leaves it while `active`. */
  dialogRef: RefObject<HTMLElement | null>;
  /** What receives focus on open (the close button: the one control every state has). */
  initialFocusRef: RefObject<HTMLElement | null>;
  /** Mounted and on screen. Pass `false` while a portal is still waiting for hydration. */
  active: boolean;
  /** Escape. Heard on the window so it works wherever focus is. */
  onEscape: () => void;
  /** Where focus goes when the dialog closes; read at that moment, so a ref lookup is fine. */
  returnFocusTo: () => HTMLElement | null;
}

/**
 * Focus contract of a modal dialog, without a dependency: focus moves in on open, Tab and
 * Shift+Tab wrap inside it, Escape closes, and focus goes back to the control that opened it.
 *
 * `returnFocusTo` is a getter rather than "whatever was focused before" because the opener can be
 * gone by the time the dialog closes (the quests sheet that launches the invite card is dismissed
 * first), and the caller knows the stable target.
 */
export function useDialogFocus({
  dialogRef,
  initialFocusRef,
  active,
  onEscape,
  returnFocusTo,
}: DialogFocusOptions): void {
  const escape = useEffectEvent(onEscape);
  const restore = useEffectEvent(returnFocusTo);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;
    initialFocusRef.current?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        escape();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = tabbables(dialog);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const current = document.activeElement;
      const outside = !(current instanceof Node) || !dialog.contains(current);
      if (event.shiftKey ? outside || current === first : outside || current === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      restore()?.focus({ preventScroll: true });
    };
  }, [active, dialogRef, initialFocusRef]);
}

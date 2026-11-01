/** Keeps Tab / Shift+Tab inside a modal panel: from the last control back to the first and the other way. */
export function trapFocus(
  event: Pick<KeyboardEvent, "shiftKey" | "preventDefault">,
  panel: HTMLElement | null,
): void {
  if (!panel) return;
  const focusable = [...panel.querySelectorAll<HTMLElement>(
    "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href]",
  )];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Where the student last pressed, so a celebration can start its light from the tap that earned it
 * (the ✓ of "Bitti olarak işaretle" becomes the spark). Keyboard presses count too: Enter or Space
 * on a control starts the light from that control's centre.
 */
export interface LastPointer {
  x: number;
  y: number;
  /** `performance.now()` of the press. */
  at: number;
}

let last: LastPointer | null = null;
let listeners = 0;

function recordPointer(event: PointerEvent): void {
  last = { x: event.clientX, y: event.clientY, at: performance.now() };
}

function recordKey(event: KeyboardEvent): void {
  if ((event.key !== "Enter" && event.key !== " ") || !(event.target instanceof Element)) return;
  const rect = event.target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;
  last = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, at: performance.now() };
}

/** Starts recording; returns the uninstall. Safe to call from several places at once. */
export function installLastPointer(): () => void {
  if (typeof window === "undefined") return () => undefined;
  listeners += 1;
  if (listeners === 1) {
    window.addEventListener("pointerdown", recordPointer, { capture: true, passive: true });
    window.addEventListener("keydown", recordKey, { capture: true, passive: true });
  }
  return () => {
    listeners -= 1;
    if (listeners > 0) return;
    window.removeEventListener("pointerdown", recordPointer, { capture: true });
    window.removeEventListener("keydown", recordKey, { capture: true });
  };
}

export function lastPointer(): LastPointer | null {
  return last;
}

/** Force a layout reflow so CSS animations restart cleanly. */
export function forceReflow(el: HTMLElement): void {
  void el.offsetWidth;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function readCssMs(el: Element, varName: string, fallbackMs: number): number {
  const raw = getComputedStyle(el).getPropertyValue(varName).trim();
  if (!raw) return fallbackMs;
  if (raw.endsWith("ms")) return Number.parseFloat(raw) || fallbackMs;
  if (raw.endsWith("s")) return (Number.parseFloat(raw) || 0) * 1000 || fallbackMs;
  return Number.parseFloat(raw) || fallbackMs;
}

/**
 * Mobile chrome metrics after header/footer redesign (2026-07-23):
 * - Top bar: h-16 (64px) — avatar + two-line greeting
 * - Floating pill tab: ~60px bar + 12px inset + small Koç overhang ≈ 80px
 */
export const MOBILE_TAB_BAR_PADDING_CLASS =
  "pb-[calc(80px+env(safe-area-inset-bottom))] pt-16 lg:pt-0";

/** Fill the viewport under the mobile header + tab pill. Desktop is a full `100dvh`. */
export const MOBILE_BELOW_APP_CHROME_HEIGHT_CLASS =
  "h-[calc(100dvh-4rem-80px-env(safe-area-inset-bottom))] lg:h-[100dvh]";

/** Sticky elements above the mobile tab bar (e.g. koç composer). */
export const MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS =
  "bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-0";

/**
 * Mobile chrome metrics after header/footer redesign (2026-07-23):
 * - Top bar: h-16 (64px) — avatar + two-line greeting
 * - Floating pill tab: ~60px bar + 12px inset + small Koç overhang ≈ 80px
 */
export const MOBILE_TAB_BAR_PADDING_CLASS =
  "pb-[calc(80px+env(safe-area-inset-bottom))] pt-16 lg:pt-0";

/** Sticky elements above the mobile tab bar (e.g. koç composer). */
export const MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS =
  "bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-0";

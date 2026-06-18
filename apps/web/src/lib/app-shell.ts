/** DESIGN.md §6 — mobile tab bar 63px + safe-area for home indicator. */
export const MOBILE_TAB_BAR_PADDING_CLASS =
  "pb-[calc(63px+env(safe-area-inset-bottom))]";

/** Sticky elements above the mobile tab bar (e.g. koç composer). */
export const MOBILE_TAB_BAR_STICKY_BOTTOM_CLASS =
  "bottom-[calc(63px+env(safe-area-inset-bottom))] lg:bottom-0";

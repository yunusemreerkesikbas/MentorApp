/** App chrome metrics, mirrored from the web's phone layout (`apps/web/src/components/app-nav.tsx`). */
export const APP_HEADER_HEIGHT = 64;
export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_SIDE_INSET = 12;

/** The floating tab bar sits 12dp above the screen edge, or above the gesture bar when taller. */
export function tabBarBottom(insetBottom: number): number {
  return Math.max(12, insetBottom);
}

/** Bottom padding a tab screen needs so its last card clears the floating tab bar. */
export function tabBarClearance(insetBottom: number): number {
  return TAB_BAR_HEIGHT + tabBarBottom(insetBottom) + 16;
}

/** The card shadow, `--shadow-card`: a soft blue-tinted lift. */
export const cardShadow = {
  shadowColor: "#254996",
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

/** `color-mix(in srgb, a t%, b)` for two `#RRGGBB` colours. */
export function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(a, i) * t + channel(b, i) * (1 - t))
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${mixed.join("")}`;
}

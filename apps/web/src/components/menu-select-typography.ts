export type MenuSelectTextSize = "sm" | "base";

export function menuSelectTextClass(size: MenuSelectTextSize = "base"): string {
  return size === "sm" ? "text-sm" : "text-base";
}

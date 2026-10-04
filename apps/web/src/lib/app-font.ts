/**
 * Canvas `font` family for the app face. `next/font` registers Nunito under a hashed family name
 * and exposes it only through `--font-nunito`, so a literal `"Nunito"` silently falls back to the
 * generic sans in canvas exports. Read the resolved value once fonts are ready.
 */
export function appFontFamily(): string {
  const resolved =
    typeof document === "undefined"
      ? ""
      : getComputedStyle(document.documentElement).getPropertyValue("--font-nunito").trim();
  return `${resolved || '"Nunito"'}, sans-serif`;
}

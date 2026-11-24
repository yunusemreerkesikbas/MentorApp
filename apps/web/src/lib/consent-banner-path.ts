/**
 * Analytics cookie banner is public-only (the landing, knowledge articles, legal, forum).
 * The welcome slider, auth, onboarding, and the authenticated app never show it.
 * The banner separately requires a resolved anonymous session, including on public paths.
 */
const PUBLIC_SEO_LP_PATHS = new Set([
  "/for-coaches",
  "/pomodoro-timer",
  "/yks-study-program",
  "/tyt-study-program",
  "/lgs-study-program",
  "/mistake-notebook",
  "/study-app",
]);

export function isPublicConsentBannerPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/discover-community") return true;
  if (PUBLIC_SEO_LP_PATHS.has(pathname)) return true;
  if (pathname === "/knowledge" || pathname.startsWith("/knowledge/")) return true;
  if (pathname.startsWith("/legal/")) return true;
  if (pathname === "/forum" || pathname.startsWith("/forum/")) return true;
  return false;
}

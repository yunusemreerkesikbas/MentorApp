/**
 * Analytics cookie banner is public-only (knowledge articles, legal, forum).
 * Welcome `/`, auth, onboarding, and the authenticated app never show it.
 * The banner separately requires a resolved anonymous session, including on public paths.
 */
export function isPublicConsentBannerPath(pathname: string): boolean {
  if (pathname === "/knowledge" || pathname.startsWith("/knowledge/")) return true;
  if (pathname.startsWith("/legal/")) return true;
  if (pathname === "/forum" || pathname.startsWith("/forum/")) return true;
  return false;
}

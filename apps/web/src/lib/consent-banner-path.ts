/**
 * Analytics cookie banner is public-only (knowledge articles, legal, forum).
 * Welcome `/`, auth, onboarding, and the authenticated app never show it.
 */
export function isPublicConsentBannerPath(pathname: string): boolean {
  if (pathname.startsWith("/knowledge/")) return true;
  if (pathname.startsWith("/legal/")) return true;
  if (pathname === "/forum" || pathname.startsWith("/forum/")) return true;
  return false;
}

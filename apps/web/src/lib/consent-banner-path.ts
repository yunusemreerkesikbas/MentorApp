/**
 * Analytics cookie banner is public-only (landing, knowledge, legal, forum).
 * Auth, onboarding, and the authenticated app never show it.
 */
export function isPublicConsentBannerPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/knowledge" || pathname.startsWith("/knowledge/")) return true;
  if (pathname.startsWith("/legal/")) return true;
  if (pathname === "/forum" || pathname.startsWith("/forum/")) return true;
  return false;
}

const NOTIFICATION_ROUTE_MAP: Readonly<Record<string, string>> = {
  "/dashboard": "/(app)/(tabs)/dashboard",
  "/panel": "/(app)/(tabs)/dashboard",
  "/plan": "/(app)/(tabs)/plan",
  "/coach": "/(app)/(tabs)/coach",
  "/coach/chat": "/(app)/(tabs)/coach",
  "/koc": "/(app)/(tabs)/coach",
  "/koc/sohbet": "/(app)/(tabs)/coach",
  "/analysis": "/(app)/(tabs)/analysis",
  "/analiz": "/(app)/(tabs)/analysis",
  "/notebook": "/(app)/(tabs)/analysis",
  "/defter": "/(app)/(tabs)/analysis",
  "/community": "/(app)/(tabs)/community",
  "/topluluk": "/(app)/(tabs)/community",
  "/study-rooms": "/(app)/(tabs)/community",
  "/study-session": "/(app)/study-session",
  "/seans": "/(app)/study-session",
  "/students": "/(app)/(tabs)/students",
  "/coach-profile": "/(app)/(tabs)/coach-profile",
  "/my-coach": "/(app)/(tabs)/settings",
  "/kocum": "/(app)/(tabs)/settings",
  "/settings": "/(app)/(tabs)/settings",
  "/ayarlar": "/(app)/(tabs)/settings",
  "/profile": "/(app)/(tabs)/settings",
  "/profil": "/(app)/(tabs)/settings",
  "/bilgi": "/(app)/knowledge",
  "/knowledge": "/(app)/knowledge",
};

/**
 * Resolves a backend notification `linkUrl` (which may use TR or EN web paths or locale prefixes)
 * into a safe internal Expo Router destination for `apps/mobile`.
 * Returns `null` for empty, external, or unrecognized paths.
 */
export function resolveNotificationMobileRoute(
  linkUrl: string | null | undefined,
): string | null {
  if (!linkUrl) return null;
  const trimmed = linkUrl.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? "";
  const withoutLocale = withoutQuery.replace(/^\/(tr|en)(?=\/|$)/, "") || "/";

  const exact = NOTIFICATION_ROUTE_MAP[withoutLocale];
  if (exact) return exact;

  if (
    withoutLocale.startsWith("/community/") ||
    withoutLocale.startsWith("/topluluk/")
  ) {
    return "/(app)/(tabs)/community";
  }
  if (withoutLocale.startsWith("/students/")) {
    return "/(app)/(tabs)/students";
  }
  if (
    withoutLocale.startsWith("/bilgi/") ||
    withoutLocale.startsWith("/knowledge/")
  ) {
    return "/(app)/knowledge";
  }

  return null;
}

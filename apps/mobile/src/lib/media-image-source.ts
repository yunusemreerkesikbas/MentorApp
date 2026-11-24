export interface MobileMediaImageSource {
  uri: string;
  headers?: Record<string, string>;
}

/** The grant URL may name the media host. Only the configured API receives a bearer. */
export function mobileMediaImageSource(
  rawUrl: string | null | undefined,
  apiBase: string,
  accessToken: string | null,
): MobileMediaImageSource | undefined {
  if (!rawUrl) return undefined;
  let url: URL;
  try {
    url = new URL(rawUrl, apiBase);
  } catch {
    return undefined;
  }
  if (url.pathname !== "/v1/storage/media/private") return { uri: url.href };
  const grant = url.searchParams.get("grant");
  if (!grant || !accessToken) return undefined;
  const target = new URL("/v1/storage/media/mobile-private", apiBase);
  target.searchParams.set("grant", grant);
  return {
    uri: target.href,
    headers: { Authorization: `Bearer ${accessToken}`, "X-Client-Platform": "mobile" },
  };
}

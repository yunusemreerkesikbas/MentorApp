/** Strips a trailing /v1 because generated operation paths include the prefix. */
export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return raw.replace(/\/v1\/?$/, "");
}

export function resolveApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBaseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

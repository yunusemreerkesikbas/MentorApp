import { apiBaseUrl } from "@/lib/api-base";

/**
 * The landing's "Son 24 saatte {n} kişi burada çalıştı". `null` shows no line: below the API's
 * threshold, or the API is unreachable (a missing line costs nothing, a wrong one costs trust).
 * Cached for 5 minutes per server, so the page itself never waits on a fresh query.
 */
export async function fetchStudiedLast24h(): Promise<number | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/v1/coaching/public/pulse`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const count = body && typeof body === "object" ? (body as { studiedLast24h?: unknown }).studiedLast24h : null;
    return typeof count === "number" && Number.isInteger(count) && count > 0 ? count : null;
  } catch {
    return null;
  }
}

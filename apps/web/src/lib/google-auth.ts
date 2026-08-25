import { apiBaseUrl } from "@/lib/api-base";

export async function fetchGoogleAuthEnabled(): Promise<boolean> {
  const url = `${apiBaseUrl()}/v1/auth/google/status`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return false;
  const body: unknown = await res.json().catch(() => null);
  return Boolean(body && typeof body === "object" && (body as { enabled?: unknown }).enabled === true);
}

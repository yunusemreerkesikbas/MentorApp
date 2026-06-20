import type { ApiError } from "@mentor/types";

export interface ApiClientConfig {
  baseUrl: string;
  /** Returns the in-memory access token (set by the auth provider); null when logged out. */
  getAccessToken?: () => string | null;
  /** Returns the current locale (e.g. "tr", "en"); used for Accept-Language header. */
  getLocale?: () => string;
}

let config: ApiClientConfig = { baseUrl: "" };

/** Configure once at app startup (e.g. in the web auth provider). */
export function configureApiClient(next: ApiClientConfig): void {
  config = next;
}

/** Error thrown for non-2xx responses — carries the backend's localized ApiError. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    // The backend message is already localized → display directly (engineering-principles §5).
    super(body.message);
    this.name = "ApiClientError";
  }
}

/** Locale-aware fallback for malformed/unexpected API responses. */
const FALLBACK_MESSAGES: Record<string, string> = {
  en: "An unexpected error occurred.",
  tr: "Beklenmeyen bir hata oluştu.",
};

function getFallbackMessage(): string {
  const locale = config.getLocale?.() ?? "tr";
  return FALLBACK_MESSAGES[locale] ?? FALLBACK_MESSAGES["tr"]!;
}

/**
 * Fetch wrapper used by every generated operation (orval mutator).
 * - `credentials: "include"` → the httpOnly refresh cookie flows to /v1/auth/*.
 * - Adds the Bearer access token when available.
 * - Sends Accept-Language so the backend returns localized messages.
 */
export async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body)
    headers.set("content-type", "application/json");
  const token = config.getAccessToken?.();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const locale = config.getLocale?.();
  if (locale) headers.set("accept-language", locale);

  const res = await fetch(`${config.baseUrl}${url}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const apiError: ApiError =
      body && typeof body === "object" && "code" in body
        ? (body as ApiError)
        : { code: "INTERNAL_ERROR", message: getFallbackMessage() };
    throw new ApiClientError(res.status, apiError);
  }
  return body as T;
}

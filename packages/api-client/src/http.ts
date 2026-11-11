import type { ApiError } from "@mentor/types";

export interface ApiClientConfig {
  baseUrl: string;
  /** Returns the in-memory access token (set by the auth provider); null when logged out. */
  getAccessToken?: () => string | null;
  /** Returns the current locale (e.g. "tr", "en"); used for Accept-Language header. */
  getLocale?: () => string;
  /** Identifies client surface (`"mobile"` enables SecureStore refresh token header flow). */
  clientPlatform?: "web" | "mobile";
  /** Returns the SecureStore refresh token on mobile for `/v1/auth/refresh` and `/v1/auth/logout`. */
  getRefreshToken?: () => string | null;
}

let config: ApiClientConfig = { baseUrl: "" };

/** Configure once at app startup (e.g. in the web or mobile auth provider). */
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
  en: "Something went sideways. Let's try again in a moment.",
  tr: "Bir şey ters gitti. Biraz sonra bir daha deneyelim.",
};

function getFallbackMessage(): string {
  const locale = config.getLocale?.() ?? "tr";
  return FALLBACK_MESSAGES[locale] ?? FALLBACK_MESSAGES["tr"]!;
}

const REFRESH_TOKEN_PATHS = new Set(["/v1/auth/refresh", "/v1/auth/logout"]);

/**
 * Fetch wrapper used by every generated operation (orval mutator).
 * - `credentials: "include"` on web → the httpOnly refresh cookie flows to /v1/auth/*.
 * - `X-Client-Platform: mobile` + `X-Refresh-Token` on mobile → SecureStore rotation.
 * - Adds the Bearer access token when available.
 * - Sends Accept-Language so the backend returns localized messages.
 */
export async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await httpRaw(url, init);

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

/**
 * Same auth/locale headers as `http`, but returns the raw Response — for streaming endpoints
 * (SSE over POST) where the caller reads `res.body` incrementally. Does NOT throw on non-2xx;
 * callers that need the localized ApiError can pass the response to `throwApiClientError`.
 */
export async function httpRaw(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body)
    headers.set("content-type", "application/json");
  const token = config.getAccessToken?.();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const locale = config.getLocale?.();
  if (locale) headers.set("accept-language", locale);
  if (config.clientPlatform === "mobile") {
    headers.set("x-client-platform", "mobile");
    if (REFRESH_TOKEN_PATHS.has(url)) {
      const refreshToken = config.getRefreshToken?.();
      if (refreshToken) headers.set("x-refresh-token", refreshToken);
    }
  }

  return fetch(`${config.baseUrl}${url}`, {
    ...init,
    headers,
    credentials: config.clientPlatform === "mobile" ? "omit" : "include",
  });
}

/** Parse a non-2xx Response body into the localized ApiClientError (streaming callers). */
export async function throwApiClientError(res: Response): Promise<never> {
  const body: unknown = await res.json().catch(() => undefined);
  const apiError: ApiError =
    body && typeof body === "object" && "code" in body
      ? (body as ApiError)
      : { code: "INTERNAL_ERROR", message: getFallbackMessage() };
  throw new ApiClientError(res.status, apiError);
}

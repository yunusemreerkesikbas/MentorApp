import { ApiClientError } from "@mentor/api-client";

export function isReauthenticationRequired(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 403 && error.body.code === "AUTH_REAUTHENTICATION_REQUIRED";
}

export function loginSecurityReason(search: string): "reauth" | "emailchanged" | null {
  const reason = new URLSearchParams(search).get("reason");
  return reason === "reauth" || reason === "emailchanged" ? reason : null;
}

export function accountSecurityLoginHref(reason: "reauth" | "emailchanged") {
  return { pathname: "/login" as const, query: { next: "/profile", reason } };
}

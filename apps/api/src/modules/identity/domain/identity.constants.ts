/** Identity domain constants (tunables come from env config; these are invariants). */

export const EmailTokenType = {
  VERIFY_EMAIL: "VERIFY_EMAIL",
  RESET_PASSWORD: "RESET_PASSWORD",
} as const;
export type EmailTokenType = (typeof EmailTokenType)[keyof typeof EmailTokenType];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
  /** Self-service KVKK erasure ("hesabımı sil"). Login is blocked by the `status !== ACTIVE` gate. */
  DELETED: "DELETED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/** Password reset TTL is intentionally not admin-tunable. */
export const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000; // 1h

/** Name of the httpOnly refresh cookie. */
export const REFRESH_COOKIE = "mentor_refresh";
/** Cookie path: only the auth endpoints ever receive the refresh token. */
export const REFRESH_COOKIE_PATH = "/v1/auth";

export const GOOGLE_OAUTH_STATE_COOKIE = "mentor_google_oauth";
export const GOOGLE_OAUTH_COOKIE_PATH = "/v1/auth/google";
export const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export const AuthProvider = {
  GOOGLE: "google",
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

/** JWT payload shape (access token). */
export interface AccessTokenPayload {
  sub: string;
  roles: string[];
  orgId: string | null;
}

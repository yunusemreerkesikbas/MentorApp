/**
 * Auth API contracts — shared by api (producer) and web/mobile (consumers).
 * Refresh token travels ONLY in an httpOnly cookie; it never appears in these payloads.
 */
import type { ExamType, UserRole } from "./index.js";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  organizationId: string | null;
  examType: ExamType | null;
  examDate: string | null; // ISO date (yyyy-mm-dd)
  emailVerified: boolean;
  createdAt: string; // ISO datetime
}

/** Response of signup/login/refresh: short-lived access token + the user snapshot. */
export interface AuthSession {
  accessToken: string;
  /** Seconds until the access token expires (client schedules silent refresh). */
  expiresIn: number;
  user: AuthUser;
}

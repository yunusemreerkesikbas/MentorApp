/**
 * Auth API contracts — shared by api (producer) and web/mobile (consumers).
 * Refresh token travels ONLY in an httpOnly cookie; it never appears in these payloads.
 */
import type { ExamType, ExamVariant, UserRole } from "./index.js";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  /** Public profile self-description; null when unset. */
  bio: string | null;
  /** Public personal link (http/https); null when unset. */
  website: string | null;
  roles: UserRole[];
  organizationId: string | null;
  examType: ExamType | null;
  /** KPSS only — which guide the candidate sits. Null for every other family. */
  examVariant: ExamVariant | null;
  examDate: string | null; // ISO date (yyyy-mm-dd)
  /** Daily focus goal in minutes; null = no goal set. */
  dailyFocusGoalMinutes: number | null;
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

/** POST /v1/users/me/avatar-upload-url response. */
export interface AvatarUploadUrlDto {
  uploadUrl: string;
  key: string;
  expiresAt: string;
  maxBytes: number;
}

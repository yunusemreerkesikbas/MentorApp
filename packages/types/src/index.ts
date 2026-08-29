/**
 * @mentor/types — shared, stable contracts.
 *
 * Only types shared by ALL surfaces (api/web/admin/mobile/panel) go here.
 * Feature-specific types stay in their own module.
 * Source: roadmap §9/§11.
 */

// --- Roles & org (§9/§11) — data model is org/coach-ready from day one ---
export const UserRole = {
  STUDENT: "STUDENT",
  COACH: "COACH",
  ORG_ADMIN: "ORG_ADMIN",
  EDITOR: "EDITOR",
  ADMIN: "ADMIN",
  /** Team/beta accounts: always-premium entitlement WITHOUT a subscription row
   *  (keeps payment statistics clean; no trial-once side effects). */
  STAFF: "STAFF",
  // --- Fine admin sub-roles (§9 panel RBAC). ADMIN stays as the legacy full-access alias;
  //     SUPER_ADMIN is the new explicit top. SUPPORT/FINANCE/MODERATOR are scoped admin roles. ---
  /** Scoped: user management (search/detail/status). */
  SUPPORT: "SUPPORT",
  /** Scoped: subscriptions/refunds + economy adjustments + revenue metrics. */
  FINANCE: "FINANCE",
  /** Scoped: forum/community moderation (Phase 2 — reserved, no endpoints yet). */
  MODERATOR: "MODERATOR",
  /** Full admin access (umbrella). Can assign other roles. */
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Admin sub-roles a SUPER_ADMIN may assign via the API (§9). Excludes SUPER_ADMIN/ADMIN
 * (no privilege escalation — bootstrap the first super-admin via SQL) and STAFF (own endpoint).
 */
export const ASSIGNABLE_ADMIN_ROLES = [
  UserRole.EDITOR,
  UserRole.SUPPORT,
  UserRole.FINANCE,
  UserRole.MODERATOR,
] as const;

// --- Exam-agnostic core (§0): exams differ only by content/config ---
export const ExamType = {
  KPSS: "KPSS",
  YKS: "YKS",
  LGS: "LGS",
} as const;
export type ExamType = (typeof ExamType)[keyof typeof ExamType];

/**
 * Which KPSS guide a candidate sits — stored on `users.examVariant` and on `exams.variant`.
 *
 * Only KPSS splits this way, and the split is not cosmetic: the three guides have different exam
 * dates and advertise different vacancies, so without it an ORTAOGRETIM candidate counts down to
 * the LISANS date and browses vacancies they cannot apply to.
 */
export const ExamVariant = {
  LISANS: "LISANS",
  ONLISANS: "ONLISANS",
  ORTAOGRETIM: "ORTAOGRETIM",
} as const;
export type ExamVariant = (typeof ExamVariant)[keyof typeof ExamVariant];

// --- Economy ledger (§3/§11): balance = sum of rows, never a single number ---
export const Currency = {
  XP: "XP",
  COIN: "COIN",
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const LedgerStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REVERSED: "REVERSED",
} as const;
export type LedgerStatus = (typeof LedgerStatus)[keyof typeof LedgerStatus];

// --- Subscription tier (§7/§10) ---
export const SubscriptionTier = {
  FREE: "FREE",
  PREMIUM: "PREMIUM",
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

// --- API envelope (single API, /v1, backward-compatible — §8) ---
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export * from "./auth.js";
export * from "./ai.js";
export * from "./coaching.js";
export * from "./content.js";
export * from "./economy.js";
export * from "./forum.js";
export * from "./geo.js";
export * from "./community.js";
export * from "./payments.js";
export * from "./notifications.js";
export * from "./preference-simulation.js";
export * from "./ads.js";

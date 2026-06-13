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
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// --- Exam-agnostic core (§0): exams differ only by content/config ---
export const ExamType = {
  KPSS: "KPSS",
  YKS: "YKS",
  LGS: "LGS",
} as const;
export type ExamType = (typeof ExamType)[keyof typeof ExamType];

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
export * from "./coaching.js";
export * from "./content.js";
export * from "./payments.js";
export * from "./notifications.js";

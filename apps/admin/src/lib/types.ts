import type { UserRole } from "@mentor/types";

// Admin API response shapes (mirror the NestJS admin module's view DTOs). Shared identity
// types (AuthUser, UserRole) come from @mentor/types; these are admin-panel specific.

export interface AdminUserView {
    id: string;
    email: string;
    displayName: string;
    roles: UserRole[];
    status: string;
    isStaff: boolean;
    createdAt: string;
}

export interface AdminUserDetail extends AdminUserView {
    organizationId: string | null;
    examType: string | null;
    examDate: string | null;
    emailVerified: boolean;
    updatedAt: string;
}

export interface EconomyBalance {
    xp: number;
    coinConfirmed: number;
    coinPending: number;
}

export interface EconomyLedgerEntry {
    id: string;
    unit: string;
    amount: number;
    reason: string;
    status: string;
    note: string | null;
    createdAt: string;
}

export interface InviteSummary {
    code: string | null;
    invited: number;
    converted: number;
}

export interface AdminQuestProgress {
    id: string;
    type: string;
    title: string;
    completed: boolean;
    completedAt: string | null;
}

export interface AdminEconomyOverview {
    balance: EconomyBalance;
    ledger: EconomyLedgerEntry[];
    invite: InviteSummary;
    quests: AdminQuestProgress[];
}

export interface AdminArticle {
    id: string;
    slug: string;
    title: string;
    body: string;
    family: string;
    category: string;
    source: string;
    sourceUrl: string;
    verifiedAt: string;
    verifiedBy: string;
    metaTitle: string | null;
    metaDescription: string | null;
    isPublished: boolean;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminExam {
    id: string;
    slug: string;
    name: string;
    family: string;
    variant: string | null;
    netRule: { kind: string; divisor: number };
    isCurrent: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminExamEvent {
    id: string;
    type: string;
    eventAt: string;
    source: string;
    sourceUrl: string;
    verifiedAt: string;
    verifiedBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminExamDetail {
    exam: AdminExam;
    events: AdminExamEvent[];
}

export interface AdminSubscriptionTx {
    id: string;
    type: string;        // TRIAL_START | RENEWAL | REFUND
    amountMinor: number; // negative for refunds
    currency: string;
    status: string;      // SUCCEEDED | FAILED | REFUNDED
    createdAt: string;
}

export interface AdminSubscriptionView {
    subscription: {
        id: string;
        planId: string;
        status: string;  // TRIALING | ACTIVE | PAST_DUE | CANCELED | EXPIRED
        trialEndsAt: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
    } | null;
    plan: { id: string; name: string; periodMonths: number; priceMinor: number; currency: string } | null;
    entitlement: { isPremium: boolean; validUntil: string | null; reason: string };
    transactions: AdminSubscriptionTx[];
}

export interface AdminMetrics {
    users: {
        total: number;
        new7d: number;
        new30d: number;
        verified: number;
        byStatus: { active: number; suspended: number; banned: number };
        byExamType: { kpss: number; yks: number; lgs: number };
    };
    subscriptions: {
        byStatus: { trialing: number; active: number; pastDue: number; canceled: number; expired: number; total: number };
        revenueMinor30d: number;
        refundedMinor: number;
        payingSubscriptions: number;
        conversionRate: number;
    };
    economy: {
        coinIssued: number;
        xpIssued: number;
        invite: { invited: number; converted: number };
    };
    generatedAt: string;
}

// GET /admin/metrics/ai — LLM cost visibility (§7). Cost is micro-USD; the UI formats to USD.
export interface AiCostWindow {
    costMicros: number;
    calls: number;
    promptTokens: number;
    completionTokens: number;
}

export interface AdminAiCost {
    windows: { d1: AiCostWindow; d7: AiCostWindow; d30: AiCostWindow };
    byModel: (AiCostWindow & { model: string })[];
    byFeature: (AiCostWindow & { feature: string })[];
    topSpenders: { userId: string; email: string; displayName: string; costMicros: number; calls: number }[];
    budget: { capMicros: number; spentMicros: number; exceeded: boolean };
    generatedAt: string;
}

// GET /admin/metrics/coach-feedback — coach reply satisfaction (Dilim 6 👍/👎 → admin report).
export interface AdminCoachFeedback {
    up: number;
    down: number;
    rated: number;
    satisfactionRate: number | null;
    downrated: { id: string; userId: string; question: string | null; reply: string; createdAt: string }[];
    generatedAt: string;
}

export interface ConfigEntry {
    key: string;
    category: string;
    type: "boolean" | "number" | "string";
    value: unknown;
    sensitive: boolean;
    description: string;
}

export interface AuditEntry {
    id: string;
    actorUserId: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    before: unknown;
    after: unknown;
    ip: string | null;
    createdAt: string;
}

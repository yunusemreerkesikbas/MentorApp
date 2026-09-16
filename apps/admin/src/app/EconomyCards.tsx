'use client'
import { DashboardError, DashboardSection, DashboardSkeleton } from "@/components/shared/admin/dashboard/DashboardSection";
import { KpiStatRow } from "@/components/shared/admin/dashboard/KpiStatRow";
import { ProgressStatRow } from "@/components/shared/admin/dashboard/ProgressStatRow";
import { WindowSparkBars } from "@/components/shared/admin/dashboard/WindowSparkBars";
import { WINDOW_CATEGORIES, WINDOW_COLORS } from "@/components/shared/admin/dashboard/windows";
import { useAuth } from "@/contentApi/authProvider";
import { useAdminResource } from "@/lib/useAdminResource";
import { canSee } from "@/lib/roles";
import type { AdminEconomyStats, EconomyFlow, EconomyReasonFlow } from "@/lib/types";
import type { ReactNode } from "react";
import { FiArrowDownCircle, FiUsers } from "react-icons/fi";

const fmtInt = (n: number) => n.toLocaleString("tr-TR");

const REASON_LABEL: Record<string, string> = {
    "quest.weekly.effort-allowance": "Haftalık aktif gün (musluk)",
    "quest.weekly.focus-sessions": "Haftalık odak seansı",
    "quest.weekly.plan-tasks": "Haftalık plan görevi",
    "quest.weekly.streak-full-week": "Haftanın 7 günü",
    "quest.daily.plan-task-done": "Günlük plan görevi",
    "quest.daily.focus-session-completed": "Günlük odak seansı",
    "quest.daily.focus-goal-met": "Günlük odak hedefi",
    "quest.daily.mood-checkin": "Günlük ruh hali",
    "quest.onboarding.profile-setup": "Onboarding: profil",
    "quest.onboarding.email-verified": "Onboarding: e-posta",
    "quest.onboarding.first-subscription": "Onboarding: abonelik",
    "quest.onboarding.invite-redeemed": "Onboarding: davet kodu",
    "invite.converted": "Davet dönüşümü",
    "invite.reverted": "Davet ödülü geri alındı",
    "ai.chat.spend": "Koç sohbeti",
    "ai.chat.refund": "Koç sohbeti iadesi",
    "streak.freeze.purchase": "Seri kurtarma",
    "streak.freeze.refund": "Seri kurtarma iadesi",
    "analysis.deep.purchase": "Derin analiz",
    "forum.answer.accepted": "Kabul edilen cevap",
    "forum.thread.posted": "Topluluk gönderisi",
};
const reasonLabel = (r: string) => REASON_LABEL[r] ?? (r.startsWith("milestone.") || r.startsWith("quest.milestone.") ? `Kilometre taşı (${r})` : r);

function flowLabel(w: EconomyFlow) {
    return `+${fmtInt(w.coinCredited)} / −${fmtInt(w.coinDebited)}`;
}

function ReasonTable({ title, icon, rows, emptyLabel }: { title: string; icon: ReactNode; rows: EconomyReasonFlow[]; emptyLabel: string }) {
    return (
        <div className="col-xxl-6">
            <div className="card stretch stretch-full">
                <div className="card-header"><h6 className="mb-0">{icon}{title}</h6></div>
                <div className="card-body p-0">
                    <table className="table table-hover mb-0">
                        <thead><tr><th>Kaynak</th><th className="text-end">Giren</th><th className="text-end">Çıkan</th><th className="text-end">Kişi</th></tr></thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={4} className="text-muted text-center py-3">{emptyLabel}</td></tr>
                            ) : rows.map((r) => (
                                <tr key={r.reason}>
                                    <td>{reasonLabel(r.reason)}</td>
                                    <td className="text-end">{r.credited > 0 ? `+${fmtInt(r.credited)}` : "-"}</td>
                                    <td className="text-end">{r.debited > 0 ? `−${fmtInt(r.debited)}` : "-"}</td>
                                    <td className="text-end">{fmtInt(r.users)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Economy visibility (§3). Ledger totals only; 3-bar chart is rolling window credited coin.
export default function EconomyCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const { data: s, loading, hasError, reload } = useAdminResource<AdminEconomyStats>("/admin/metrics/economy", canView);

    if (!canView) return null;
    if (loading) return <DashboardSkeleton title="Ekonomi verisi yükleniyor" />;
    if (hasError) return <DashboardError title="Ekonomi" description="Coin ve XP akışları alınamadı." onRetry={() => void reload()} />;
    if (!s) return null;

    const reach = s.faucetReach;
    const reachPct = reach.activeUsers7d > 0 ? Math.round((reach.earners7d / reach.activeUsers7d) * 100) : null;
    const credited = [s.windows.d1.coinCredited, s.windows.d7.coinCredited, s.windows.d30.coinCredited];
    const categories = [...WINDOW_CATEGORIES];

    return (
        <DashboardSection title="Ekonomi ve coin akışı">
            <div className="mb-3">
                <KpiStatRow
                    items={[
                        { id: "eco-d1", icon: "feather-arrow-up", title: "Son 24 saat", value: flowLabel(s.windows.d1), hint: "Giren / çıkan coin.", tone: "primary" },
                        { id: "eco-d7", icon: "feather-arrow-up", title: "Son 7 gün", value: flowLabel(s.windows.d7), hint: "Giren / çıkan coin.", tone: "teal" },
                        { id: "eco-float", icon: "feather-archive", title: "Harcanmamış coin", value: fmtInt(s.float.coinConfirmed), hint: `${fmtInt(s.float.holders)} kullanıcıda duruyor.`, tone: "warning" },
                        {
                            id: "eco-faucet",
                            icon: "feather-crosshair",
                            title: "Haftalık musluğa ulaşan",
                            value: reachPct === null ? fmtInt(reach.earners7d) : `${fmtInt(reach.earners7d)} · %${reachPct}`,
                            hint: `Son 7 günde XP kazanan ${fmtInt(reach.activeUsers7d)} kişi içinden.`,
                            tone: "success",
                        },
                    ]}
                />
            </div>

            {reachPct !== null ? (
                <div className="mb-3">
                    <ProgressStatRow
                        colClass="col-xxl-6 col-md-12"
                        items={[{
                            id: "eco-reach",
                            icon: "feather-crosshair",
                            title: "Musluk erişimi",
                            value: `%${reachPct}`,
                            hint: `Son 7 günde XP kazanan ${fmtInt(reach.activeUsers7d)} kişi içinden.`,
                            tone: "success",
                            progress: { label: `${fmtInt(reach.earners7d)} / ${fmtInt(reach.activeUsers7d)}`, percent: reachPct },
                        }]}
                    />
                </div>
            ) : null}

            <div className="mb-3">
                <WindowSparkBars
                    items={[
                        { id: "coin-d1", title: "Giren coin · 24s", value: fmtInt(s.windows.d1.coinCredited), color: WINDOW_COLORS.d1, categories, data: credited },
                        { id: "coin-d7", title: "Giren coin · 7g", value: fmtInt(s.windows.d7.coinCredited), color: WINDOW_COLORS.d7, categories, data: credited },
                        { id: "coin-d30", title: "Giren coin · 30g", value: fmtInt(s.windows.d30.coinCredited), color: WINDOW_COLORS.d30, categories, data: credited },
                    ]}
                />
            </div>

            {s.corrections.rows > 0 ? (
                <div className="alert alert-secondary py-2 mb-3" role="status">
                    <strong>Admin düzeltmeleri (30 gün):</strong> +{fmtInt(s.corrections.credited)} / −{fmtInt(s.corrections.debited)} coin,{" "}
                    {fmtInt(s.corrections.rows)} kayıt. Organik oranları bozmasın diye aşağıdaki dökümün dışında tutuluyor.
                </div>
            ) : null}

            <div className="row g-4">
                <ReasonTable
                    title="Coin kaynak bazlı (30 gün, organik)"
                    icon={<FiArrowDownCircle className="me-2" />}
                    rows={s.coinByReason}
                    emptyLabel="Coin hareketi yok"
                />
                <ReasonTable
                    title="XP kaynak bazlı (30 gün)"
                    icon={<FiUsers className="me-2" />}
                    rows={s.xpByReason}
                    emptyLabel="XP hareketi yok"
                />
            </div>
        </DashboardSection>
    );
}

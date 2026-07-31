'use client'
import { useEffect, useState, type ReactNode } from "react";
import { FiArrowDownCircle, FiArrowUpCircle, FiDatabase, FiTarget, FiUsers } from "react-icons/fi";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { canSee } from "@/lib/roles";
import type { AdminEconomyStats, EconomyFlow, EconomyReasonFlow } from "@/lib/types";

const fmtInt = (n: number) => n.toLocaleString("tr-TR");

// Ledger reason → admin-facing Turkish label. Deliberately NOT shared with the API's
// `ledger-entry-view.ts`: that copy is written for the end user ("Görev ödülü"), this is the
// operator's vocabulary. Unknown reasons fall through as the raw key — new quests stay visible.
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

function Kpi({ icon, value, label, hint }: { icon: ReactNode; value: string | number; label: string; hint?: string }) {
    return (
        <div className="col-xxl-3 col-md-6">
            <div className="card stretch stretch-full">
                <div className="card-body">
                    <div className="d-flex align-items-center gap-3">
                        <span className="d-inline-flex align-items-center justify-content-center bg-soft-primary text-primary rounded" style={{ width: 44, height: 44 }}>
                            {icon}
                        </span>
                        <div>
                            <div className="fs-4 fw-bold text-dark lh-1">{value}</div>
                            <div className="fs-12 text-muted mt-1">{label}</div>
                            {hint ? <div className="fs-11 text-muted">{hint}</div> : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

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
                                    <td className="text-end">{r.credited > 0 ? `+${fmtInt(r.credited)}` : "—"}</td>
                                    <td className="text-end">{r.debited > 0 ? `−${fmtInt(r.debited)}` : "—"}</td>
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

// Economy visibility (§3) — read-only, SUPPORT/FINANCE. Reads the append-only ledger: where coin
// comes from, where it goes, how much sits unspent, and whether the recurring weekly faucet
// actually reaches people. These are the numbers the earning rates get calibrated from (§729) —
// without them, tuning the caps/rewards is guesswork. Flag-independent (admin tool).
export default function EconomyCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const [s, setS] = useState<AdminEconomyStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!canView) return;
        let active = true;
        apiClient
            .get<AdminEconomyStats>("/admin/metrics/economy")
            .then(({ data }) => { if (active) setS(data); })
            .catch(() => { if (active) setS(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [canView]);

    if (!canView) return null;
    if (loading) return <div className="text-muted mb-4">Ekonomi verisi yükleniyor…</div>;
    if (!s) return null;

    const reach = s.faucetReach;
    // Of the people earning anything this week, how many cleared the weekly coin quest.
    const reachPct = reach.activeUsers7d > 0 ? Math.round((reach.earners7d / reach.activeUsers7d) * 100) : null;

    return (
        <div className="mb-4">
            <h6 className="mb-2 text-muted">Ekonomi (coin akışı)</h6>

            <div className="row g-4 mb-3">
                <Kpi icon={<FiArrowUpCircle size={20} />} value={flowLabel(s.windows.d1)} label="Son 24 saat" hint="giren / çıkan coin" />
                <Kpi icon={<FiArrowUpCircle size={20} />} value={flowLabel(s.windows.d7)} label="Son 7 gün" hint="giren / çıkan coin" />
                <Kpi
                    icon={<FiDatabase size={20} />}
                    value={fmtInt(s.float.coinConfirmed)}
                    label="Harcanmamış coin (float)"
                    hint={`${fmtInt(s.float.holders)} kullanıcıda duruyor`}
                />
                <Kpi
                    icon={<FiTarget size={20} />}
                    value={reachPct === null ? fmtInt(reach.earners7d) : `${fmtInt(reach.earners7d)} · %${reachPct}`}
                    label="Haftalık musluğa ulaşan"
                    hint={`son 7 günde XP kazanan ${fmtInt(reach.activeUsers7d)} kişi içinden`}
                />
            </div>

            {s.corrections.rows > 0 ? (
                <div className="alert alert-secondary py-2 mb-3" role="status">
                    <strong>Admin düzeltmeleri (30 gün):</strong> +{fmtInt(s.corrections.credited)} / −{fmtInt(s.corrections.debited)} coin,{" "}
                    {fmtInt(s.corrections.rows)} kayıt — organik oranları bozmasın diye aşağıdaki dökümün dışında tutuluyor.
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
        </div>
    );
}

'use client'
import { useEffect, useState, type ReactNode } from "react";
import { FiUsers, FiUserPlus, FiCreditCard, FiDollarSign, FiGift, FiAward, FiRepeat, FiPlayCircle } from "react-icons/fi";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { canSee } from "@/lib/roles";
import type { AdminMetrics } from "@/lib/types";

const fmtTry = (minor: number) => `${(minor / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

function Kpi({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Admin metrics KPI snapshot (W6) — read-only, ADMIN only. Renders nothing for non-admins (the
// endpoint is ADMIN-gated). Money comes from the API in minor units; we only format here.
export default function MetricsCards() {
    const { admin } = useAuth();
    // Metrics are visible to SUPPORT/FINANCE + the full-access umbrella (mirrors the API gate).
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const [m, setM] = useState<AdminMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!canView) return;
        let active = true;
        apiClient
            .get<AdminMetrics>("/admin/metrics")
            .then(({ data }) => { if (active) setM(data); })
            .catch(() => { if (active) setM(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [canView]);

    if (!canView) return null;
    if (loading) return <div className="text-muted mb-4">Metrikler yükleniyor…</div>;
    if (!m) return null;

    const convPct = `${Math.round(m.subscriptions.conversionRate * 100)}%`;
    const repeatPct = `${Math.round(m.coaching.repeatRate7d * 100)}%`;

    return (
        <div className="mb-4">
            <h6 className="mb-2 text-muted">Kullanıcılar</h6>
            <div className="row g-4 mb-3">
                <Kpi icon={<FiUsers size={20} />} value={m.users.total} label="Toplam kullanıcı" />
                <Kpi icon={<FiUserPlus size={20} />} value={m.users.new7d} label="Yeni (7 gün)" />
                <Kpi icon={<FiUserPlus size={20} />} value={m.users.new30d} label="Yeni (30 gün)" />
                <Kpi icon={<FiUsers size={20} />} value={m.users.verified} label="E-posta doğrulanmış" />
            </div>

            <h6 className="mb-2 text-muted">Abonelik & Gelir</h6>
            <div className="row g-4 mb-3">
                <Kpi icon={<FiCreditCard size={20} />} value={m.subscriptions.byStatus.active} label="Aktif abonelik" />
                <Kpi icon={<FiCreditCard size={20} />} value={m.subscriptions.byStatus.trialing} label="Denemede" />
                <Kpi icon={<FiDollarSign size={20} />} value={fmtTry(m.subscriptions.revenueMinor30d)} label="Gelir (son 30g)" />
                <Kpi icon={<FiAward size={20} />} value={convPct} label="Ödemeye dönüşüm" />
            </div>

            <h6 className="mb-2 text-muted">Ekonomi</h6>
            <div className="row g-4">
                <Kpi icon={<FiAward size={20} />} value={m.economy.coinIssued} label="Dağıtılan coin" />
                <Kpi icon={<FiAward size={20} />} value={m.economy.xpIssued} label="Dağıtılan XP" />
                <Kpi icon={<FiGift size={20} />} value={`${m.economy.invite.converted}/${m.economy.invite.invited}`} label="Davet (dönüşen/toplam)" />
                <Kpi icon={<FiDollarSign size={20} />} value={fmtTry(m.subscriptions.refundedMinor)} label="İade (son 30g)" />
            </div>

            <h6 className="mb-2 mt-3 text-muted">Koçluk devamlılığı (7 gün)</h6>
            <div className="row g-4">
                <Kpi icon={<FiUsers size={20} />} value={m.coaching.activeUsers7d} label="Seans yapan kullanıcı" />
                <Kpi icon={<FiRepeat size={20} />} value={m.coaching.repeatUsers7d} label="2+ farklı günde seans" />
                <Kpi icon={<FiRepeat size={20} />} value={repeatPct} label="7 günlük tekrar oranı" />
            </div>

            <h6 className="mb-2 mt-3 text-muted">Reklam görevleri</h6>
            <div className="row g-4">
                <Kpi icon={<FiPlayCircle size={20} />} value={m.ads.rewarded} label="Tamamlanan reklam" />
                <Kpi icon={<FiUsers size={20} />} value={m.ads.uniqueUsers} label="Benzersiz kullanıcı" />
                <Kpi icon={<FiAward size={20} />} value={m.ads.coinGranted} label="Reklamdan verilen Coin" />
                <Kpi icon={<FiPlayCircle size={20} />} value={`${m.ads.closed}/${m.ads.expired + m.ads.rejected}`} label="Kapanan / hatalı" />
            </div>
            <a className="d-inline-block mt-2 fs-12" href="https://admanager.google.com/" target="_blank" rel="noreferrer">Gelir ve eCPM için Google Ad Manager’ı aç ↗</a>
        </div>
    );
}

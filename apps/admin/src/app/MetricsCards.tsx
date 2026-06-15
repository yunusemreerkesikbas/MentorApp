'use client'
import { useEffect, useState, type ReactNode } from "react";
import { FiUsers, FiUserPlus, FiCreditCard, FiDollarSign, FiGift, FiAward } from "react-icons/fi";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
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
    const isAdmin = (admin?.roles ?? []).includes("ADMIN");
    const [m, setM] = useState<AdminMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin) return;
        let active = true;
        apiClient
            .get<AdminMetrics>("/admin/metrics")
            .then(({ data }) => { if (active) setM(data); })
            .catch(() => { if (active) setM(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [isAdmin]);

    if (!isAdmin) return null;
    if (loading) return <div className="text-muted mb-4">Metrikler yükleniyor…</div>;
    if (!m) return null;

    const convPct = `${Math.round(m.subscriptions.conversionRate * 100)}%`;

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
        </div>
    );
}

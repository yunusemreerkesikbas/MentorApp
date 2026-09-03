'use client'
import { useCallback, useEffect, useState } from "react";
import { FiUsers, FiUserPlus, FiCreditCard, FiDollarSign, FiGift, FiAward, FiRepeat, FiPlayCircle } from "react-icons/fi";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { MetricCard } from "@/components/shared/admin/MetricCard";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { canSee } from "@/lib/roles";
import type { AdminMetrics } from "@/lib/types";

const fmtTry = (minor: number) => `${(minor / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

// Admin metrics KPI snapshot (W6) — read-only, ADMIN only. Renders nothing for non-admins (the
// endpoint is ADMIN-gated). Money comes from the API in minor units; we only format here.
export default function MetricsCards() {
    const { admin } = useAuth();
    // Metrics are visible to SUPPORT/FINANCE + the full-access umbrella (mirrors the API gate).
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const [m, setM] = useState<AdminMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const load = useCallback(async () => {
        if (!canView) return;
        setLoading(true);
        setHasError(false);
        try {
            const { data } = await apiClient.get<AdminMetrics>("/admin/metrics");
            setM(data);
        } catch {
            setM(null);
            setHasError(true);
        } finally {
            setLoading(false);
        }
    }, [canView]);

    useEffect(() => { void load(); }, [load]);

    if (!canView) return null;
    if (loading) return <div className="card mb-4"><AsyncState status="loading" size="compact" title="Metrikler yükleniyor" /></div>;
    if (hasError) return <div className="card mb-4"><AsyncState status="error" size="compact" title="Metrikler yüklenemedi" description="Kullanıcı, abonelik ve temel kullanım verileri alınamadı." onRetry={() => void load()} /></div>;
    if (!m) return null;

    const convPct = `${Math.round(m.subscriptions.conversionRate * 100)}%`;
    const repeatPct = `${Math.round(m.coaching.repeatRate7d * 100)}%`;

    return (
        <div className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">Kullanıcılar</h2>
            <div className="row g-4 mb-3">
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiUsers size={20} />} value={m.users.total} label="Toplam kullanıcı" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiUserPlus size={20} />} value={m.users.new7d} label="Yeni kullanıcı" hint="Son 7 günde kaydolan kullanıcı sayısı." /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiUserPlus size={20} />} value={m.users.new30d} label="Yeni kullanıcı" hint="Son 30 günde kaydolan kullanıcı sayısı." /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiUsers size={20} />} value={m.users.verified} label="E-posta doğrulanmış" /></div>
            </div>

            <h2 className="admin-dashboard-section-title">Abonelik ve gelir</h2>
            <div className="row g-4 mb-3">
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiCreditCard size={20} />} value={m.subscriptions.byStatus.active} label="Aktif abonelik" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiCreditCard size={20} />} value={m.subscriptions.byStatus.trialing} label="Denemede" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiDollarSign size={20} />} value={fmtTry(m.subscriptions.revenueMinor30d)} label="Gelir" hint="Son 30 gündeki toplam gelir." /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiAward size={20} />} value={convPct} label="Ödemeye dönüşüm" /></div>
            </div>

            <h2 className="admin-dashboard-section-title">Ekonomi</h2>
            <div className="row g-4">
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiAward size={20} />} value={m.economy.coinIssued} label="Dağıtılan coin" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiAward size={20} />} value={m.economy.xpIssued} label="Dağıtılan XP" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiGift size={20} />} value={`${m.economy.invite.converted}/${m.economy.invite.invited}`} label="Davet dönüşümü" hint="Dönüşen davet / toplam davet." /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiDollarSign size={20} />} value={fmtTry(m.subscriptions.refundedMinor)} label="İade" hint="Son 30 gündeki toplam iade." /></div>
            </div>

            <h2 className="admin-dashboard-section-title mt-3">Koçluk devamlılığı</h2>
            <div className="row g-4">
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiUsers size={20} />} value={m.coaching.activeUsers7d} label="Seans yapan kullanıcı" hint="Son 7 gün." /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiRepeat size={20} />} value={m.coaching.repeatUsers7d} label="Tekrar eden kullanıcı" hint="Son 7 günde en az iki farklı günde seans yapanlar." /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiRepeat size={20} />} value={repeatPct} label="Tekrar oranı" hint="Son 7 gün." /></div>
            </div>

            <h2 className="admin-dashboard-section-title mt-3">Reklam görevleri</h2>
            <div className="row g-4">
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiPlayCircle size={20} />} value={m.ads.rewarded} label="Tamamlanan reklam" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiUsers size={20} />} value={m.ads.uniqueUsers} label="Benzersiz kullanıcı" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiAward size={20} />} value={m.ads.coinGranted} label="Verilen coin" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiPlayCircle size={20} />} value={`${m.ads.closed}/${m.ads.expired + m.ads.rejected}`} label="Kapanan / hatalı" /></div>
            </div>
            <a className="d-inline-block mt-2 fs-12" href="https://admanager.google.com/" target="_blank" rel="noreferrer">Gelir ve eCPM için Google Ad Manager’ı aç ↗</a>
        </div>
    );
}

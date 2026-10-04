'use client'
import { DashboardError, DashboardSection, DashboardSkeleton } from "@/components/shared/admin/dashboard/DashboardSection";
import { BucketDonut } from "@/components/shared/admin/dashboard/BucketDonut";
import { KpiStatRow } from "@/components/shared/admin/dashboard/KpiStatRow";
import { MetricStrip } from "@/components/shared/admin/dashboard/MetricStrip";
import { ProgressStatRow } from "@/components/shared/admin/dashboard/ProgressStatRow";
import { useAuth } from "@/contentApi/authProvider";
import { useAdminResource } from "@/lib/useAdminResource";
import { canSee } from "@/lib/roles";
import type { AdminMetrics } from "@/lib/types";

const fmtTry = (minor: number) => `${(minor / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;
const fmtInt = (n: number) => n.toLocaleString("tr-TR");
const pct = (rate: number) => `${Math.round(rate * 100)}%`;

// Admin metrics KPI snapshot (W6) — read-only. SUPPORT/FINANCE + umbrella. Money is minor units;
// FE only formats. Donuts/strip render payload buckets that were previously unused.
export default function MetricsCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const { data: m, loading, hasError, reload } = useAdminResource<AdminMetrics>("/admin/metrics", canView);

    if (!canView) return null;
    if (loading) return <DashboardSkeleton title="Metrikler yükleniyor" />;
    if (hasError) return <DashboardError title="Metrikler" description="Kullanıcı, abonelik ve temel kullanım verileri alınamadı." onRetry={() => void reload()} />;
    if (!m) return null;

    const inviteTotal = m.economy.invite.invited;
    const adsFaulty = m.ads.expired + m.ads.rejected;

    return (
        <>
            <DashboardSection title="Kullanıcılar">
                <KpiStatRow
                    items={[
                        { id: "users-total", icon: "feather-users", title: "Toplam kullanıcı", value: fmtInt(m.users.total), href: "/users", tone: "primary" },
                        { id: "users-7d", icon: "feather-user-plus", title: "Yeni kullanıcı", value: fmtInt(m.users.new7d), hint: "Son 7 günde kaydolan kullanıcı sayısı.", tone: "success" },
                        { id: "users-30d", icon: "feather-user-plus", title: "Yeni kullanıcı", value: fmtInt(m.users.new30d), hint: "Son 30 günde kaydolan kullanıcı sayısı.", tone: "teal" },
                        { id: "users-verified", icon: "feather-user-check", title: "E-posta doğrulanmış", value: fmtInt(m.users.verified), tone: "warning" },
                    ]}
                />
            </DashboardSection>

            <MetricStrip
                title="Kullanıcı dağılımı"
                subtitle="Durum ve sınav tipi, anlık sayım"
                href="/users"
                hrefLabel="Kullanıcılar"
                items={[
                    { id: "st-active", icon: "feather-user-check", title: "Aktif", value: fmtInt(m.users.byStatus.active), tone: "success" },
                    { id: "st-suspended", icon: "feather-pause", title: "Askıda", value: fmtInt(m.users.byStatus.suspended), tone: "warning" },
                    { id: "st-banned", icon: "feather-x", title: "Yasaklı", value: fmtInt(m.users.byStatus.banned), tone: "danger" },
                    { id: "ex-kpss", icon: "feather-clipboard", title: "KPSS", value: fmtInt(m.users.byExamType.kpss), tone: "primary" },
                    { id: "ex-yks", icon: "feather-layers", title: "YKS", value: fmtInt(m.users.byExamType.yks), tone: "teal" },
                    { id: "ex-lgs", icon: "feather-grid", title: "LGS", value: fmtInt(m.users.byExamType.lgs), tone: "success" },
                ]}
            />

            <div className="row g-4 mb-4">
                <BucketDonut
                    title="Sınav tipi"
                    items={[
                        { id: "kpss", label: "KPSS", value: m.users.byExamType.kpss },
                        { id: "yks", label: "YKS", value: m.users.byExamType.yks },
                        { id: "lgs", label: "LGS", value: m.users.byExamType.lgs },
                    ]}
                />
                <BucketDonut
                    title="Abonelik durumu"
                    items={[
                        { id: "trialing", label: "Deneme", value: m.subscriptions.byStatus.trialing },
                        { id: "active", label: "Aktif", value: m.subscriptions.byStatus.active },
                        { id: "pastDue", label: "Gecikmiş", value: m.subscriptions.byStatus.pastDue },
                        { id: "canceled", label: "İptal", value: m.subscriptions.byStatus.canceled },
                        { id: "expired", label: "Süresi dolmuş", value: m.subscriptions.byStatus.expired },
                    ]}
                />
            </div>

            <DashboardSection title="Abonelik ve gelir">
                <KpiStatRow
                    items={[
                        { id: "sub-active", icon: "feather-shopping-bag", title: "Aktif abonelik", value: fmtInt(m.subscriptions.byStatus.active), subtitle: `${fmtInt(m.subscriptions.payingSubscriptions)} ödeyen`, tone: "primary" },
                        { id: "sub-trial", icon: "feather-clock", title: "Denemede", value: fmtInt(m.subscriptions.byStatus.trialing), tone: "teal" },
                        { id: "sub-revenue", icon: "feather-dollar-sign", title: "Gelir", value: fmtTry(m.subscriptions.revenueMinor30d), hint: "Son 30 gündeki toplam gelir.", tone: "success" },
                        { id: "sub-conv", icon: "feather-award", title: "Ödemeye dönüşüm", value: pct(m.subscriptions.conversionRate), tone: "warning" },
                    ]}
                />
            </DashboardSection>

            <DashboardSection title="Ekonomi">
                <KpiStatRow
                    items={[
                        { id: "eco-coin", icon: "feather-award", title: "Dağıtılan coin", value: fmtInt(m.economy.coinIssued), tone: "primary" },
                        { id: "eco-xp", icon: "feather-star", title: "Dağıtılan XP", value: fmtInt(m.economy.xpIssued), tone: "teal" },
                        { id: "eco-invite", icon: "feather-link-2", title: "Davet dönüşümü", value: `${fmtInt(m.economy.invite.converted)}/${fmtInt(inviteTotal)}`, hint: "Dönüşen davet / toplam davet.", tone: "success" },
                        { id: "eco-refund", icon: "feather-dollar-sign", title: "İade", value: fmtTry(m.subscriptions.refundedMinor), hint: "Son 30 gündeki toplam iade.", tone: "danger" },
                    ]}
                />
            </DashboardSection>

            <DashboardSection title="Koçluk devamlılığı">
                <ProgressStatRow
                    items={[
                        { id: "coach-active", icon: "feather-users", title: "Seans yapan kullanıcı", value: fmtInt(m.coaching.activeUsers7d), hint: "Son 7 gün.", tone: "primary" },
                        { id: "coach-repeat", icon: "feather-repeat", title: "Tekrar eden kullanıcı", value: fmtInt(m.coaching.repeatUsers7d), hint: "Son 7 günde en az iki farklı günde seans yapanlar.", tone: "teal" },
                        {
                            id: "coach-rate",
                            icon: "feather-repeat",
                            title: "Tekrar oranı",
                            value: pct(m.coaching.repeatRate7d),
                            hint: "Son 7 gün.",
                            tone: "success",
                            progress: { label: pct(m.coaching.repeatRate7d), percent: Math.round(m.coaching.repeatRate7d * 100) },
                        },
                        {
                            id: "invite-progress",
                            icon: "feather-link-2",
                            title: "Davet dönüşümü",
                            value: `${fmtInt(m.economy.invite.converted)}/${fmtInt(inviteTotal)}`,
                            hint: "Dönüşen davet / toplam davet.",
                            tone: "warning",
                            progress: {
                                label: inviteTotal > 0 ? `${fmtInt(m.economy.invite.converted)} dönüşen` : "Davet yok",
                                percent: inviteTotal > 0 ? Math.round((m.economy.invite.converted / inviteTotal) * 100) : 0,
                            },
                        },
                    ]}
                />
            </DashboardSection>

            <DashboardSection title="Reklam görevleri">
                <KpiStatRow
                    items={[
                        { id: "ads-rewarded", icon: "feather-airplay", title: "Tamamlanan reklam", value: fmtInt(m.ads.rewarded), subtitle: `${fmtInt(m.ads.created)} oluşturuldu`, tone: "primary" },
                        { id: "ads-users", icon: "feather-users", title: "Benzersiz kullanıcı", value: fmtInt(m.ads.uniqueUsers), tone: "teal" },
                        { id: "ads-coin", icon: "feather-award", title: "Verilen coin", value: fmtInt(m.ads.coinGranted), tone: "success" },
                    ]}
                />
                <div className="mt-3">
                    <ProgressStatRow
                        colClass="col-xxl-6 col-md-12"
                        items={[{
                            id: "ads-closed",
                            icon: "feather-check-circle",
                            title: "Kapanan / hatalı",
                            value: `${fmtInt(m.ads.closed)}/${fmtInt(adsFaulty)}`,
                            tone: "warning",
                            progress: {
                                label: adsFaulty + m.ads.closed > 0 ? `${fmtInt(m.ads.closed)} kapanan` : "Kayıt yok",
                                percent: adsFaulty + m.ads.closed > 0 ? Math.round((m.ads.closed / (m.ads.closed + adsFaulty)) * 100) : 0,
                            },
                        }]}
                    />
                </div>
                <a className="d-inline-block mt-2 fs-12" href="https://admanager.google.com/" target="_blank" rel="noreferrer">Gelir ve eCPM için Google Ad Manager’ı aç ↗</a>
            </DashboardSection>
        </>
    );
}

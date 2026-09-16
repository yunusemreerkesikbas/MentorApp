'use client'
import { DashboardError, DashboardSection, DashboardSkeleton } from "@/components/shared/admin/dashboard/DashboardSection";
import { KpiStatRow } from "@/components/shared/admin/dashboard/KpiStatRow";
import { useAuth } from "@/contentApi/authProvider";
import { useAdminResource } from "@/lib/useAdminResource";
import { canSee } from "@/lib/roles";
import type { AdminSponsorshipStats } from "@/lib/types";

const fmtUsd = (micros: number) => `$${(micros / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const fmtInt = (n: number) => n.toLocaleString("tr-TR");

// Coach-sponsored Premium (W8 seats). Money arrives in micro-USD; we only format.
export default function SponsorshipCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const { data: s, loading, hasError, reload } = useAdminResource<AdminSponsorshipStats>("/admin/metrics/sponsorship", canView);

    if (!canView) return null;
    if (loading) return <DashboardSkeleton title="Sponsorluk yükleniyor" />;
    if (hasError) return <DashboardError title="Koç sponsorluğu" description="Koltuk sayısı ve kohort maliyeti alınamadı." onRetry={() => void reload()} />;
    if (!s) return null;

    return (
        <DashboardSection title="Koç sponsorluğu">
            {!s.sponsorshipEnabled ? (
                <div className="alert alert-secondary mb-3" role="status">
                    <strong>Sponsorluk kapalı.</strong> Yeni bağlar Premium açmıyor.
                    {s.seats > 0 ? ` Hâlâ ${fmtInt(s.seats)} koltuk canlı görünüyor.` : ""}
                </div>
            ) : null}

            {s.truncated ? (
                <div className="alert alert-warning mb-3" role="status">
                    Kohort ölçüm tavanını aştı; aşağıdaki maliyetler <strong>eksik sayıyor</strong>.
                </div>
            ) : null}

            <KpiStatRow
                items={[
                    { id: "seat-live", icon: "feather-award", title: "Canlı koltuk", value: fmtInt(s.seats), hint: "Premium'u koçu ödüyor", tone: "primary" },
                    { id: "seat-free", icon: "feather-sliders", title: "Koç başına ücretsiz koltuk", value: fmtInt(s.freeSeatsPerCoach), hint: "mentorship.coach.free_seats", tone: "teal" },
                    {
                        id: "seat-cost",
                        icon: "feather-users",
                        title: "Koltuk başına (30g)",
                        value: s.costPerSeatMicros30d === null ? "-" : fmtUsd(s.costPerSeatMicros30d),
                        hint: s.costPerSeatMicros30d === null ? "Henüz koltuk yok" : "free_seats bu sayıya göre ayarlanır",
                        tone: "warning",
                    },
                    {
                        id: "seat-cohort",
                        icon: "feather-dollar-sign",
                        title: "Kohort maliyeti (30g)",
                        value: fmtUsd(s.costMicros.d30),
                        hint: `24s ${fmtUsd(s.costMicros.d1)} · 7g ${fmtUsd(s.costMicros.d7)}`,
                        tone: "success",
                    },
                ]}
            />
        </DashboardSection>
    );
}

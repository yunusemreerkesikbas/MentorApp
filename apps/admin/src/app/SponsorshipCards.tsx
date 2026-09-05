'use client'
import { useCallback, useEffect, useState } from "react";
import { FiDollarSign, FiGift, FiSliders, FiUsers } from "react-icons/fi";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { MetricCard } from "@/components/shared/admin/MetricCard";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { canSee } from "@/lib/roles";
import type { AdminSponsorshipStats } from "@/lib/types";

// Micro-USD → "$0.0000", matching AiCostCards: per-seat spend is small enough that fewer decimals
// would round the interesting number to zero.
const fmtUsd = (micros: number) => `$${(micros / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const fmtInt = (n: number) => n.toLocaleString("tr-TR");

// Coach-sponsored Premium (W8 seats) — read-only. mentorship.coach.free_seats is the knob that
// bounds the whole giveaway; this section exists so its value can be judged against what it costs
// instead of guessed. Money arrives in micro-USD; we only format.
export default function SponsorshipCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const [s, setS] = useState<AdminSponsorshipStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const load = useCallback(async () => {
        if (!canView) return;
        setLoading(true);
        setHasError(false);
        try {
            const { data } = await apiClient.get<AdminSponsorshipStats>("/admin/metrics/sponsorship");
            setS(data);
        } catch {
            setS(null);
            setHasError(true);
        } finally {
            setLoading(false);
        }
    }, [canView]);

    useEffect(() => { void load(); }, [load]);

    if (!canView) return null;
    if (loading) return <div className="card mb-4"><AsyncState status="loading" size="compact" title="Sponsorluk yükleniyor" /></div>;
    if (hasError) return <div className="card mb-4"><AsyncState status="error" size="compact" title="Sponsorluk yüklenemedi" description="Koltuk sayısı ve kohort maliyeti alınamadı." onRetry={() => void load()} /></div>;
    if (!s) return null;

    return (
        <section className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">Koç sponsorluğu</h2>

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

            <div className="row g-4">
                <div className="col-xxl-3 col-md-6">
                    <MetricCard icon={<FiGift size={20} />} value={fmtInt(s.seats)} label="Canlı koltuk" hint="Premium'u koçu ödüyor" />
                </div>
                <div className="col-xxl-3 col-md-6">
                    <MetricCard icon={<FiSliders size={20} />} value={fmtInt(s.freeSeatsPerCoach)} label="Koç başına ücretsiz koltuk" hint="mentorship.coach.free_seats" />
                </div>
                <div className="col-xxl-3 col-md-6">
                    {/* Null means no seats, not free seats — the difference decides whether the knob
                        above is set too high, so it must not render as $0.0000. */}
                    <MetricCard
                        icon={<FiUsers size={20} />}
                        value={s.costPerSeatMicros30d === null ? "—" : fmtUsd(s.costPerSeatMicros30d)}
                        label="Koltuk başına (30g)"
                        hint={s.costPerSeatMicros30d === null ? "Henüz koltuk yok" : "free_seats bu sayıya göre ayarlanır"}
                    />
                </div>
                <div className="col-xxl-3 col-md-6">
                    <MetricCard icon={<FiDollarSign size={20} />} value={fmtUsd(s.costMicros.d30)} label="Kohort maliyeti (30g)" hint={`24s ${fmtUsd(s.costMicros.d1)} · 7g ${fmtUsd(s.costMicros.d7)}`} />
                </div>
            </div>
        </section>
    );
}

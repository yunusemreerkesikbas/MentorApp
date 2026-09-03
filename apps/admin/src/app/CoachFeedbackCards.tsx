'use client'
import { useCallback, useEffect, useState } from "react";
import { FiThumbsUp, FiThumbsDown, FiSmile, FiMessageSquare } from "react-icons/fi";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { MetricCard } from "@/components/shared/admin/MetricCard";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { canSee } from "@/lib/roles";
import type { AdminCoachFeedback } from "@/lib/types";

const fmtInt = (n: number) => n.toLocaleString("tr-TR");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

// Coach reply satisfaction (Dilim 6 signal → admin report) — read-only, ADMIN only. Satisfaction
// rate + the most recent 👎 replies with the question that prompted each (admin-only free text).
export default function CoachFeedbackCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const [f, setF] = useState<AdminCoachFeedback | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const load = useCallback(async () => {
        if (!canView) return;
        setLoading(true);
        setHasError(false);
        try {
            const { data } = await apiClient.get<AdminCoachFeedback>("/admin/metrics/coach-feedback");
            setF(data);
        } catch {
            setF(null);
            setHasError(true);
        } finally {
            setLoading(false);
        }
    }, [canView]);

    useEffect(() => { void load(); }, [load]);

    if (!canView) return null;
    if (loading) return <div className="card mb-4"><AsyncState status="loading" size="compact" title="Koç memnuniyeti yükleniyor" /></div>;
    if (hasError) return <div className="card mb-4"><AsyncState status="error" size="compact" title="Koç memnuniyeti yüklenemedi" description="Geri bildirim ve kırılım verileri alınamadı." onRetry={() => void load()} /></div>;
    if (!f) return null;

    const ratePct = f.satisfactionRate === null ? "—" : `${Math.round(f.satisfactionRate * 100)}%`;

    return (
        <section className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">Koç memnuniyeti</h2>
            <div className="row g-4 mb-3">
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiSmile size={20} />} value={ratePct} label="Memnuniyet oranı" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiThumbsUp size={20} />} value={fmtInt(f.up)} label="Beğeni" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiThumbsDown size={20} />} value={fmtInt(f.down)} label="Beğenmeme" /></div>
                <div className="col-xxl-3 col-md-6"><MetricCard icon={<FiMessageSquare size={20} />} value={fmtInt(f.rated)} label="Toplam oylanan" /></div>
            </div>

            <div className="card stretch stretch-full mb-3">
                <div className="card-header"><h6 className="mb-0">Mentor V2 kırılımları</h6></div>
                <div className="card-body">
                    <div className="row g-3">
                        {(["strategyVersion", "intent", "tone", "actionStatus"] as const).map((dimension) => (
                            <div key={dimension} className="col-xl-3 col-md-6">
                                <div className="fs-12 text-uppercase text-muted mb-2">{dimension}</div>
                                {f.breakdowns[dimension].length === 0 ? (
                                    <div className="text-muted fs-12">Kayıt yok</div>
                                ) : f.breakdowns[dimension].map((item) => (
                                    <div key={item.value} className="d-flex justify-content-between gap-2 fs-12 py-1 border-bottom">
                                        <span className="text-dark text-truncate">{item.value}</span>
                                        <span className="text-muted text-nowrap">
                                            {item.satisfactionRate === null ? "—" : `${Math.round(item.satisfactionRate * 100)}%`} · {item.rated}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card stretch stretch-full">
                <div className="card-header"><h6 className="mb-0"><FiThumbsDown className="me-2" />Son 👎 yanıtlar</h6></div>
                <div className="card-body p-0">
                    <table className="table table-hover mb-0">
                        <thead><tr><th style={{ width: "35%" }}>Soru</th><th>Koç yanıtı</th><th className="text-end" style={{ width: 120 }}>Tarih</th></tr></thead>
                        <tbody>
                            {f.downrated.length === 0 ? (
                                <tr><td colSpan={3} className="text-muted text-center py-3">Kayıt yok</td></tr>
                            ) : f.downrated.map((d) => (
                                <tr key={d.id}>
                                    <td className="text-muted">{d.question ?? "—"}</td>
                                    <td>{d.reply}</td>
                                    <td className="text-end text-muted">{fmtDate(d.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

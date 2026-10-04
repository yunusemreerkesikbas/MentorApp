'use client'
import { FiThumbsDown } from "react-icons/fi";
import { DashboardError, DashboardSection, DashboardSkeleton } from "@/components/shared/admin/dashboard/DashboardSection";
import { KpiStatRow } from "@/components/shared/admin/dashboard/KpiStatRow";
import { ProgressStatRow } from "@/components/shared/admin/dashboard/ProgressStatRow";
import { useAuth } from "@/contentApi/authProvider";
import { useAdminResource } from "@/lib/useAdminResource";
import { canSee } from "@/lib/roles";
import type { AdminCoachFeedback } from "@/lib/types";

const fmtInt = (n: number) => n.toLocaleString("tr-TR");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

// Coach reply satisfaction. Rate comes from the API; FE only formats.
export default function CoachFeedbackCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const { data: f, loading, hasError, reload } = useAdminResource<AdminCoachFeedback>("/admin/metrics/coach-feedback", canView);

    if (!canView) return null;
    if (loading) return <DashboardSkeleton title="Koç memnuniyeti yükleniyor" />;
    if (hasError) return <DashboardError title="Koç memnuniyeti" description="Geri bildirim ve kırılım verileri alınamadı." onRetry={() => void reload()} />;
    if (!f) return null;

    const ratePct = f.satisfactionRate === null ? "-" : `${Math.round(f.satisfactionRate * 100)}%`;
    const rateBar = f.satisfactionRate === null ? null : Math.round(f.satisfactionRate * 100);

    return (
        <DashboardSection title="Koç memnuniyeti">
            <div className="mb-3">
                <KpiStatRow
                    items={[
                        { id: "fb-rate", icon: "feather-star", title: "Memnuniyet oranı", value: ratePct, tone: "success" },
                        { id: "fb-up", icon: "feather-check-circle", title: "Beğeni", value: fmtInt(f.up), tone: "primary" },
                        { id: "fb-down", icon: "feather-x", title: "Beğenmeme", value: fmtInt(f.down), tone: "danger" },
                        { id: "fb-rated", icon: "feather-message-square", title: "Toplam oylanan", value: fmtInt(f.rated), tone: "teal" },
                    ]}
                />
            </div>

            {rateBar !== null ? (
                <div className="mb-3">
                    <ProgressStatRow
                        colClass="col-xxl-6 col-md-12"
                        items={[{
                            id: "fb-progress",
                            icon: "feather-star",
                            title: "Memnuniyet",
                            value: ratePct,
                            tone: "success",
                            progress: { label: `${fmtInt(f.up)} / ${fmtInt(f.rated)}`, percent: rateBar },
                        }]}
                    />
                </div>
            ) : null}

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
                                            {item.satisfactionRate === null ? "-" : `${Math.round(item.satisfactionRate * 100)}%`} · {item.rated}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card stretch stretch-full">
                <div className="card-header"><h6 className="mb-0"><FiThumbsDown className="me-2" />Son olumsuz yanıtlar</h6></div>
                <div className="card-body p-0">
                    <table className="table table-hover mb-0">
                        <thead><tr><th style={{ width: "35%" }}>Soru</th><th>Koç yanıtı</th><th className="text-end" style={{ width: 120 }}>Tarih</th></tr></thead>
                        <tbody>
                            {f.downrated.length === 0 ? (
                                <tr><td colSpan={3} className="text-muted text-center py-3">Kayıt yok</td></tr>
                            ) : f.downrated.map((d) => (
                                <tr key={d.id}>
                                    <td className="text-muted">{d.question ?? "-"}</td>
                                    <td>{d.reply}</td>
                                    <td className="text-end text-muted">{fmtDate(d.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardSection>
    );
}

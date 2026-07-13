'use client'
import { useEffect, useState, type ReactNode } from "react";
import { FiThumbsUp, FiThumbsDown, FiSmile, FiMessageSquare } from "react-icons/fi";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { canSee } from "@/lib/roles";
import type { AdminCoachFeedback } from "@/lib/types";

const fmtInt = (n: number) => n.toLocaleString("tr-TR");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

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

// Coach reply satisfaction (Dilim 6 signal → admin report) — read-only, ADMIN only. Satisfaction
// rate + the most recent 👎 replies with the question that prompted each (admin-only free text).
export default function CoachFeedbackCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const [f, setF] = useState<AdminCoachFeedback | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!canView) return;
        let active = true;
        apiClient
            .get<AdminCoachFeedback>("/admin/metrics/coach-feedback")
            .then(({ data }) => { if (active) setF(data); })
            .catch(() => { if (active) setF(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [canView]);

    if (!canView) return null;
    if (loading) return <div className="text-muted mb-4">Koç memnuniyeti yükleniyor…</div>;
    if (!f) return null;

    const ratePct = f.satisfactionRate === null ? "—" : `${Math.round(f.satisfactionRate * 100)}%`;

    return (
        <div className="mb-4">
            <h6 className="mb-2 text-muted">Koç Memnuniyeti</h6>
            <div className="row g-4 mb-3">
                <Kpi icon={<FiSmile size={20} />} value={ratePct} label="Memnuniyet oranı" />
                <Kpi icon={<FiThumbsUp size={20} />} value={fmtInt(f.up)} label="Beğeni (👍)" />
                <Kpi icon={<FiThumbsDown size={20} />} value={fmtInt(f.down)} label="Beğenmeme (👎)" />
                <Kpi icon={<FiMessageSquare size={20} />} value={fmtInt(f.rated)} label="Toplam oylanan" />
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
        </div>
    );
}

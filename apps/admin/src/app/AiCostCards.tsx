'use client'
import { useCallback, useEffect, useState } from "react";
import { FiCpu, FiDollarSign, FiPieChart, FiZap } from "react-icons/fi";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { MetricCard } from "@/components/shared/admin/MetricCard";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { canSee } from "@/lib/roles";
import type { AdminAiCost, AiCostWindow } from "@/lib/types";

// Micro-USD → "$0.0000". Per-call cost is tiny, so 4 decimals keep small windows readable.
const fmtUsd = (micros: number) => `$${(micros / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const fmtInt = (n: number) => n.toLocaleString("tr-TR");

// feature slug → Turkish label (unknown/legacy rows come back as "other").
const FEATURE_LABEL: Record<string, string> = {
    chat: "Sohbet",
    vision: "Foto kategorize",
    mood: "Ruh hali",
    ghost: "Geçmiş Halin",
    vision_note: "Hedef notu",
    session_reflection: "Seans yansıması",
    weekly_review: "Haftalık özet",
    memory: "Hafıza profili",
    daily_greeting: "Günlük selam",
    plan_draft: "Plan taslağı",
    other: "Diğer",
};
const featureLabel = (f: string) => FEATURE_LABEL[f] ?? f;

function windowLabel(w: AiCostWindow) {
    return `${fmtUsd(w.costMicros)} · ${fmtInt(w.calls)} çağrı`;
}

// AI/LLM cost visibility (§7) — read-only, ADMIN only. Aggregates the ai_usage meter: rolling
// windows + per-model + top spenders. Money comes from the API in micro-USD; we only format here.
export default function AiCostCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const [c, setC] = useState<AdminAiCost | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const load = useCallback(async () => {
        if (!canView) return;
        setLoading(true);
        setHasError(false);
        try {
            const { data } = await apiClient.get<AdminAiCost>("/admin/metrics/ai");
            setC(data);
        } catch {
            setC(null);
            setHasError(true);
        } finally {
            setLoading(false);
        }
    }, [canView]);

    useEffect(() => { void load(); }, [load]);

    if (!canView) return null;
    if (loading) return <div className="card mb-4"><AsyncState status="loading" size="compact" title="AI maliyeti yükleniyor" /></div>;
    if (hasError) return <div className="card mb-4"><AsyncState status="error" size="compact" title="AI maliyeti yüklenemedi" description="Maliyet ve kullanım dağılımları alınamadı." onRetry={() => void load()} /></div>;
    if (!c) return null;

    const budget = c.budget;
    const budgetPct = budget.capMicros > 0 ? Math.round((budget.spentMicros / budget.capMicros) * 100) : 0;
    // Banner only when a cap is set: red at/over 100% (blocked), yellow ≥80% (warning), else green.
    const budgetTone = budget.exceeded ? "danger" : budgetPct >= 80 ? "warning" : "success";

    return (
        <section className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">AI maliyeti</h2>

            {budget.capMicros > 0 ? (
                <div className={`alert alert-${budgetTone} d-flex justify-content-between align-items-center mb-3`} role="status">
                    <span>
                        <strong>Aylık bütçe:</strong> {fmtUsd(budget.spentMicros)} / {fmtUsd(budget.capMicros)} ({budgetPct}%)
                    </span>
                    <span className="fw-bold">
                        {budget.exceeded ? "AI bloklu — ay sonuna kadar duraklatıldı" : budgetPct >= 80 ? "Sınıra yaklaşılıyor" : "Bütçe içinde"}
                    </span>
                </div>
            ) : null}

            <div className="row g-4 mb-3">
                <div className="col-xxl-4 col-md-6"><MetricCard icon={<FiDollarSign size={20} />} value={windowLabel(c.windows.d1)} label="Son 24 saat" /></div>
                <div className="col-xxl-4 col-md-6"><MetricCard icon={<FiDollarSign size={20} />} value={windowLabel(c.windows.d7)} label="Son 7 gün" /></div>
                <div className="col-xxl-4 col-md-6"><MetricCard icon={<FiDollarSign size={20} />} value={windowLabel(c.windows.d30)} label="Son 30 gün" /></div>
            </div>

            <div className="row g-4">
                <div className="col-xxl-4">
                    <div className="card stretch stretch-full">
                        <div className="card-header"><h6 className="mb-0"><FiCpu className="me-2" />Model bazlı (30 gün)</h6></div>
                        <div className="card-body p-0">
                            <table className="table table-hover mb-0">
                                <thead><tr><th>Model</th><th className="text-end">Maliyet</th><th className="text-end">Çağrı</th><th className="text-end">Token</th></tr></thead>
                                <tbody>
                                    {c.byModel.length === 0 ? (
                                        <tr><td colSpan={4} className="text-muted text-center py-3">Kayıt yok</td></tr>
                                    ) : c.byModel.map((m) => (
                                        <tr key={m.model}>
                                            <td>{m.model}</td>
                                            <td className="text-end">{fmtUsd(m.costMicros)}</td>
                                            <td className="text-end">{fmtInt(m.calls)}</td>
                                            <td className="text-end">{fmtInt(m.promptTokens + m.completionTokens)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="col-xxl-4">
                    <div className="card stretch stretch-full">
                        <div className="card-header"><h6 className="mb-0"><FiPieChart className="me-2" />Özellik bazlı (30 gün)</h6></div>
                        <div className="card-body p-0">
                            <table className="table table-hover mb-0">
                                <thead><tr><th>Özellik</th><th className="text-end">Maliyet</th><th className="text-end">Çağrı</th></tr></thead>
                                <tbody>
                                    {c.byFeature.length === 0 ? (
                                        <tr><td colSpan={3} className="text-muted text-center py-3">Kayıt yok</td></tr>
                                    ) : c.byFeature.map((ft) => (
                                        <tr key={ft.feature}>
                                            <td>{featureLabel(ft.feature)}</td>
                                            <td className="text-end">{fmtUsd(ft.costMicros)}</td>
                                            <td className="text-end">{fmtInt(ft.calls)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="col-xxl-4">
                    <div className="card stretch stretch-full">
                        <div className="card-header"><h6 className="mb-0"><FiZap className="me-2" />En çok harcayan (30 gün)</h6></div>
                        <div className="card-body p-0">
                            <table className="table table-hover mb-0">
                                <thead><tr><th>Kullanıcı</th><th className="text-end">Maliyet</th><th className="text-end">Çağrı</th></tr></thead>
                                <tbody>
                                    {c.topSpenders.length === 0 ? (
                                        <tr><td colSpan={3} className="text-muted text-center py-3">Kayıt yok</td></tr>
                                    ) : c.topSpenders.map((s) => (
                                        <tr key={s.userId}>
                                            <td>
                                                <div className="fw-semibold text-dark">{s.displayName}</div>
                                                <div className="fs-12 text-muted">{s.email}</div>
                                            </td>
                                            <td className="text-end">{fmtUsd(s.costMicros)}</td>
                                            <td className="text-end">{fmtInt(s.calls)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

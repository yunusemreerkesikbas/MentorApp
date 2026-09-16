'use client'
import Link from "next/link";
import { FiCpu, FiPieChart, FiZap } from "react-icons/fi";
import { BucketDonut } from "@/components/shared/admin/dashboard/BucketDonut";
import { DashboardError, DashboardSection, DashboardSkeleton } from "@/components/shared/admin/dashboard/DashboardSection";
import { ProgressStatRow } from "@/components/shared/admin/dashboard/ProgressStatRow";
import { WindowSparkBars } from "@/components/shared/admin/dashboard/WindowSparkBars";
import { WINDOW_CATEGORIES, WINDOW_COLORS } from "@/components/shared/admin/dashboard/windows";
import { useAuth } from "@/contentApi/authProvider";
import { useAdminResource } from "@/lib/useAdminResource";
import { canSee } from "@/lib/roles";
import type { AdminAiCost, AiCostWindow } from "@/lib/types";

const fmtUsd = (micros: number) => `$${(micros / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const fmtInt = (n: number) => n.toLocaleString("tr-TR");

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
    mentorship_brief: "Koç brifingi",
    mentorship_cohort_brief: "Koç kohort brifingi",
    mentorship_suggestions: "Koç ödev önerisi",
    other: "Diğer",
};
const featureLabel = (f: string) => FEATURE_LABEL[f] ?? f;

function windowLabel(w: AiCostWindow) {
    return `${fmtUsd(w.costMicros)} · ${fmtInt(w.calls)} çağrı`;
}

// AI/LLM cost visibility (§7). Cost is micro-USD; FE only formats. 3-bar series is the rolling
// d1/d7/d30 windows from the API, not a daily curve.
export default function AiCostCards() {
    const { admin } = useAuth();
    const canView = canSee(["SUPPORT", "FINANCE"], admin?.roles);
    const { data: c, loading, hasError, reload } = useAdminResource<AdminAiCost>("/admin/metrics/ai", canView);

    if (!canView) return null;
    if (loading) return <DashboardSkeleton title="AI maliyeti yükleniyor" />;
    if (hasError) return <DashboardError title="AI maliyeti" description="Maliyet ve kullanım dağılımları alınamadı." onRetry={() => void reload()} />;
    if (!c) return null;

    const budget = c.budget;
    const budgetPct = budget.capMicros > 0 ? Math.round((budget.spentMicros / budget.capMicros) * 100) : 0;
    const budgetTone = budget.exceeded ? "danger" : budgetPct >= 80 ? "warning" : "success";
    const costSeries = [c.windows.d1.costMicros, c.windows.d7.costMicros, c.windows.d30.costMicros];
    const categories = [...WINDOW_CATEGORIES];

    return (
        <DashboardSection title="AI maliyeti">
            {budget.capMicros > 0 ? (
                <>
                    <div className={`alert alert-${budgetTone} d-flex justify-content-between align-items-center mb-3`} role="status">
                        <span>
                            <strong>Aylık bütçe:</strong> {fmtUsd(budget.spentMicros)} / {fmtUsd(budget.capMicros)} ({budgetPct}%)
                        </span>
                        <span className="fw-bold">
                            {budget.exceeded ? "AI bloklu, ay sonuna kadar duraklatıldı" : budgetPct >= 80 ? "Sınıra yaklaşılıyor" : "Bütçe içinde"}
                        </span>
                    </div>
                    <div className="mb-3">
                        <ProgressStatRow
                            colClass="col-xxl-6 col-md-12"
                            items={[{
                                id: "ai-budget",
                                icon: "feather-activity",
                                title: "Aylık bütçe",
                                value: `${fmtUsd(budget.spentMicros)} / ${fmtUsd(budget.capMicros)}`,
                                tone: budgetTone,
                                progress: { label: `${budgetPct}%`, percent: budgetPct },
                            }]}
                        />
                    </div>
                </>
            ) : null}

            <div className="mb-3">
                <WindowSparkBars
                    items={[
                        { id: "ai-d1", title: "Son 24 saat", value: windowLabel(c.windows.d1), color: WINDOW_COLORS.d1, categories, data: costSeries },
                        { id: "ai-d7", title: "Son 7 gün", value: windowLabel(c.windows.d7), color: WINDOW_COLORS.d7, categories, data: costSeries },
                        { id: "ai-d30", title: "Son 30 gün", value: windowLabel(c.windows.d30), color: WINDOW_COLORS.d30, categories, data: costSeries },
                    ]}
                />
            </div>

            <div className="row g-4 mb-3">
                <BucketDonut
                    title="Özellik bazlı çağrı (30 gün)"
                    colClass="col-12"
                    items={c.byFeature.map((ft) => ({ id: ft.feature, label: featureLabel(ft.feature), value: ft.calls }))}
                />
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
                                    ) : c.byModel.map((row) => (
                                        <tr key={row.model}>
                                            <td>{row.model}</td>
                                            <td className="text-end">{fmtUsd(row.costMicros)}</td>
                                            <td className="text-end">{fmtInt(row.calls)}</td>
                                            <td className="text-end">{fmtInt(row.promptTokens + row.completionTokens)}</td>
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
                                                <Link href={`/users/${s.userId}`} className="fw-semibold text-dark">{s.displayName}</Link>
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
        </DashboardSection>
    );
}

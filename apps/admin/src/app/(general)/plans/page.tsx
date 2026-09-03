'use client'

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiSave } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { InfoHint } from "@/components/shared/admin/InfoHint";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { AdminPlan } from "@/lib/types";

type PlanFilter = "all" | "active" | "inactive";

function formatPrice(minor: number): string {
    return (minor / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

export default function PlansPage() {
    const [plans, setPlans] = useState<AdminPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [filter, setFilter] = useState<PlanFilter>("all");

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try { const { data } = await apiClient.get<AdminPlan[]>("/admin/plans"); setPlans(data); }
        catch { setPlans([]); setError(true); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);
    const visiblePlans = useMemo(() => plans.filter((plan) => filter === "all" || (filter === "active" ? plan.isActive : !plan.isActive)), [filter, plans]);
    const updatePlan = <K extends keyof AdminPlan>(id: string, key: K, value: AdminPlan[K]) => setPlans((current) => current.map((plan) => plan.id === id ? { ...plan, [key]: value } : plan));

    const save = async (plan: AdminPlan) => {
        setBusyId(plan.id);
        try {
            const { data } = await apiClient.patch<AdminPlan>(`/admin/plans/${plan.id}`, { name: plan.name, priceMinor: plan.priceMinor, trialDays: plan.trialDays, isActive: plan.isActive });
            setPlans((current) => current.map((row) => row.id === data.id ? data : row));
            await Swal.fire({ icon: "success", title: "Kaydedildi", timer: 1000, showConfirmButton: false });
        } catch (requestError) {
            const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Kaydedilemedi.";
            await Swal.fire({ icon: "error", title: "Hata", text: message });
            await load();
        } finally { setBusyId(null); }
    };

    const state = loading ? <AsyncState status="loading" title="Planlar yükleniyor" /> : error ? <AsyncState status="error" title="Planlar yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyin." onRetry={() => void load()} /> : plans.length === 0 ? <AsyncState status="empty" title="Henüz plan yok" description="Plan kayıtları API üzerinden oluşturulduğunda burada görünür." /> : visiblePlans.length === 0 ? <AsyncState status="empty" title="Bu durumda plan yok" description="Başka bir filtre seçebilirsiniz." /> : undefined;

    return <>
        <AdminPageHeader title="Planlar" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Planlar" }]} />
        <div className="main-content"><DataTableShell state={state} toolbar={<div className="admin-table-toolbar-content"><div><div className="d-flex align-items-center gap-2"><h2 className="h6 mb-0">Abonelik planları</h2><InfoHint label="Plan düzenleme bilgisi" content="Fiyat değişikliği yalnız yeni ödeme ekranlarına uygulanır. Dönem uzunluğu bu ekrandan değiştirilemez." /></div><p className="mb-0 mt-1 fs-12 text-muted">Fiyat yalnız yeni checkout’lara uygulanır. Dönem uzunluğu kilitlidir.</p></div><div className="admin-filter-group" role="group" aria-label="Plan durumu filtresi">{([['all', 'Tümü'], ['active', 'Aktif'], ['inactive', 'Pasif']] as const).map(([value, label]) => <button key={value} type="button" className={`btn btn-sm ${filter === value ? "btn-primary" : "btn-light"}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>}>
            <table className="table align-middle mb-0 plans-table"><thead><tr><th>Plan</th><th>Fiyat</th><th>Deneme</th><th>Dönem</th><th>Durum</th><th className="text-end">İşlem</th></tr></thead><tbody>{visiblePlans.map((plan) => <tr key={plan.id}><td><label className="visually-hidden" htmlFor={`plan-name-${plan.id}`}>Plan adı</label><input id={`plan-name-${plan.id}`} className="form-control form-control-sm" value={plan.name} disabled={busyId === plan.id} onChange={(event) => updatePlan(plan.id, "name", event.target.value)} /><span className="admin-table-secondary font-monospace">{plan.id}</span></td><td><label className="visually-hidden" htmlFor={`plan-price-${plan.id}`}>Fiyat, kuruş</label><input id={`plan-price-${plan.id}`} className="form-control form-control-sm admin-plan-number" type="number" min={1} value={plan.priceMinor} disabled={busyId === plan.id} onChange={(event) => updatePlan(plan.id, "priceMinor", Number(event.target.value))} /><span className="admin-table-secondary">{formatPrice(plan.priceMinor)}</span></td><td><label className="visually-hidden" htmlFor={`plan-trial-${plan.id}`}>Deneme süresi, gün</label><input id={`plan-trial-${plan.id}`} className="form-control form-control-sm admin-plan-number" type="number" min={0} value={plan.trialDays} disabled={busyId === plan.id} onChange={(event) => updatePlan(plan.id, "trialDays", Number(event.target.value))} /><span className="admin-table-secondary">gün</span></td><td>{plan.periodMonths} ay<span className="admin-table-secondary">Değiştirilemez</span></td><td><div className="d-flex align-items-center gap-2"><div className="form-check form-switch mb-0"><input className="form-check-input" type="checkbox" aria-label={`${plan.name} aktiflik durumu`} checked={plan.isActive} disabled={busyId === plan.id} onChange={(event) => updatePlan(plan.id, "isActive", event.target.checked)} /></div><StatusBadge tone={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "Aktif" : "Pasif"}</StatusBadge></div></td><td className="text-end"><button type="button" className="btn btn-sm btn-primary" disabled={busyId === plan.id} aria-busy={busyId === plan.id || undefined} onClick={() => void save(plan)}>{busyId === plan.id ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Kaydediliyor</> : <><FiSave aria-hidden="true" /> Kaydet</>}</button></td></tr>)}</tbody></table>
        </DataTableShell></div>
    </>;
}

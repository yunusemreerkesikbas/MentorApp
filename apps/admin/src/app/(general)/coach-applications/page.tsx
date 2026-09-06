'use client'

import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiCheck, FiX } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { IconAction } from "@/components/shared/admin/IconAction";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { AdminCoachApplicationView } from "@/lib/types";

const STATUSES = [
    { value: "PENDING", label: "Değerlendirmede" },
    { value: "APPROVED", label: "Onaylandı" },
    { value: "REJECTED", label: "Reddedildi" },
] as const;

const CLAIMS = [
    { value: "INSTITUTION", label: "Kurum" },
    { value: "BRANCH", label: "Branş" },
    { value: "YEARS", label: "Deneyim" },
] as const;

const statusTone = (status: string) => status === "APPROVED" ? "success" as const : status === "REJECTED" ? "danger" as const : "warning" as const;
const statusLabel = (status: string) => STATUSES.find((s) => s.value === status)?.label ?? status;

/**
 * Coach vetting (roadmap §5 curation). Replaces the manual `POST /users/:id/roles/COACH`:
 * approving here grants COACH and records the verdict, both audited.
 *
 * The `hasCoachRole` warning is load-bearing, not decoration. The approval writes the role (W6)
 * and the verdict (W8) in two transactions — importing both ways would be a cycle — so a crash
 * between them leaves an APPROVED row with no role. Reviewing again is idempotent and fixes it.
 */
export default function CoachApplicationsPage() {
    const [rows, setRows] = useState<AdminCoachApplicationView[]>([]);
    const [status, setStatus] = useState<string>("PENDING");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async (next: string) => {
        setLoading(true);
        setError(false);
        try {
            const { data } = await apiClient.get<AdminCoachApplicationView[]>("/admin/coach-applications", { params: { status: next } });
            setRows(data);
        } catch {
            setRows([]);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(status); }, [load, status]);

    const review = async (row: AdminCoachApplicationView, decision: "APPROVE" | "REJECT") => {
        // Claims are checkboxes rather than free text because the badge records WHICH claim was
        // verified, and only an approval carries any (a refusal verifies nothing).
        const claimInputs = decision === "APPROVE"
            ? CLAIMS.map(({ value, label }) => `<label class="d-block text-start"><input type="checkbox" id="claim-${value}"> ${label}</label>`).join("")
            : "";
        const detail = [row.institution && `Kurum: ${row.institution}`, row.branch && `Branş: ${row.branch}`, row.years !== null && `Deneyim: ${row.years} yıl`].filter(Boolean).join(" · ");

        const result = await Swal.fire({
            title: decision === "APPROVE" ? "Başvuruyu onayla" : "Başvuruyu reddet",
            html: `<p class="text-start mb-2"><strong>${row.displayName}</strong><br><span class="text-muted">${detail || "İddia belirtilmemiş"}</span></p>${claimInputs ? `<p class="text-start mb-1">Neyi doğruladın?</p>${claimInputs}` : ""}<textarea id="review-note" class="form-control mt-2" rows="3" placeholder="${decision === "APPROVE" ? "Not (isteğe bağlı)" : "Gerekçe — adaya aynen gösterilecek"}"></textarea>`,
            icon: decision === "APPROVE" ? "question" : "warning",
            showCancelButton: true,
            confirmButtonText: decision === "APPROVE" ? "Onayla ve COACH rolü ver" : "Reddet",
            cancelButtonText: "Vazgeç",
            preConfirm: () => ({
                verifiedClaims: CLAIMS.filter(({ value }) => (document.getElementById(`claim-${value}`) as HTMLInputElement | null)?.checked).map(({ value }) => value),
                reviewNote: (document.getElementById("review-note") as HTMLTextAreaElement | null)?.value.trim() || null,
            }),
        });
        if (!result.isConfirmed || !result.value) return;

        setBusyId(row.id);
        try {
            await apiClient.post(`/admin/coach-applications/${row.id}/review`, { decision, ...result.value });
            await load(status);
            await Swal.fire({ icon: "success", title: decision === "APPROVE" ? "Onaylandı" : "Reddedildi", timer: 1200, showConfirmButton: false });
        } catch (requestError) {
            const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "İşlem başarısız.";
            await Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally { setBusyId(null); }
    };

    const state = loading ? <AsyncState status="loading" title="Başvurular yükleniyor" /> : error ? <AsyncState status="error" title="Başvurular yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyin." onRetry={() => void load(status)} /> : rows.length === 0 ? <AsyncState status="empty" title={status === "PENDING" ? "Bekleyen başvuru yok" : "Bu durumda başvuru yok"} /> : undefined;

    return <>
        <AdminPageHeader title="Koç başvuruları" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Koç başvuruları" }]} />
        <div className="main-content"><DataTableShell state={state} toolbar={<div className="admin-table-toolbar-content"><div><h2 className="h6 mb-1">Kürasyon kuyruğu</h2><span className="text-muted fs-12">Onaylamak COACH rolünü de verir. {rows.length} kayıt.</span></div><div className="admin-table-search"><label className="visually-hidden" htmlFor="application-status">Duruma göre süz</label><select id="application-status" className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>{STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></div>}>
            <table className="table table-hover mb-0"><thead><tr><th>Aday</th><th>İddialar</th><th>Durum</th><th>Doğrulanan</th><th className="text-end">İşlemler</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
                <td><div className="admin-table-primary">{row.displayName || "İsimsiz"}<span>{row.email}</span></div><div className="text-muted fs-12">{row.headline}</div></td>
                <td className="fs-12">{[row.institution, row.branch, row.years !== null ? `${row.years} yıl` : null].filter(Boolean).join(" · ") || <span className="text-muted">—</span>}</td>
                <td><StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge>
                    {/* The two-transaction gap, made visible instead of trusted. */}
                    {row.status === "APPROVED" && !row.hasCoachRole && <StatusBadge tone="danger"><FiAlertTriangle aria-hidden="true" /> Rol verilmemiş</StatusBadge>}</td>
                <td>{row.verifiedClaims.length === 0 ? <span className="text-muted">—</span> : row.verifiedClaims.map((claim) => <StatusBadge key={claim} tone="info">{CLAIMS.find((c) => c.value === claim)?.label ?? claim}</StatusBadge>)}</td>
                <td className="text-end"><div className="d-inline-flex gap-2">
                    <IconAction label="Onayla ve COACH rolü ver" icon={<FiCheck aria-hidden="true" />} tone="success" busy={busyId === row.id} onClick={() => void review(row, "APPROVE")} />
                    <IconAction label="Reddet" icon={<FiX aria-hidden="true" />} tone="danger" busy={busyId === row.id} onClick={() => void review(row, "REJECT")} />
                </div></td>
            </tr>)}</tbody></table>
        </DataTableShell></div>
    </>;
}

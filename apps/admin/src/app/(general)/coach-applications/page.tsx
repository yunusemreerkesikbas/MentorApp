'use client'

import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiCheck, FiPause, FiSlash, FiTag } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { IconAction } from "@/components/shared/admin/IconAction";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { AdminCoachApplicationView } from "@/lib/types";

const STATUSES = [
    { value: "ACTIVE", label: "Açık" },
    { value: "PENDING", label: "İncelemede" },
    { value: "SUSPENDED", label: "Durduruldu" },
] as const;

const CLAIMS = [
    { value: "INSTITUTION", label: "Kurum" },
    { value: "BRANCH", label: "Branş" },
    { value: "YEARS", label: "Deneyim" },
] as const;

const statusTone = (status: string) => status === "ACTIVE" ? "success" as const : status === "SUSPENDED" ? "danger" as const : "warning" as const;
const statusLabel = (status: string) => STATUSES.find((s) => s.value === status)?.label ?? status;

/**
 * The coach registry (roadmap §5 as revised by APP-089).
 *
 * THIS SCREEN'S DIRECTION INVERTED. It used to be a vetting queue where nobody could coach until an
 * admin said yes. Registration is self-service now, so nothing here stands between a coach and their
 * account: what lives here is the power to take it back, and the badge that says we checked
 * something. The two are separate actions on purpose — reinstating a coach must not silently
 * re-assert badges nobody re-read.
 *
 * The `hasCoachRole` warning is load-bearing, not decoration. A standing change writes the role (W0,
 * through W8) and the registry row in two transactions, so a crash between them leaves a row whose
 * status and role disagree. Repeating the action is idempotent and fixes it.
 */
export default function CoachRegistryPage() {
    const [rows, setRows] = useState<AdminCoachApplicationView[]>([]);
    const [status, setStatus] = useState<string>("ACTIVE");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async (next: string) => {
        setLoading(true);
        setError(false);
        try {
            const { data } = await apiClient.get<AdminCoachApplicationView[]>("/admin/coaches", { params: { status: next } });
            setRows(data);
        } catch {
            setRows([]);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(status); }, [load, status]);

    const act = async (row: AdminCoachApplicationView, run: () => Promise<unknown>, done: string) => {
        setBusyId(row.userId);
        try {
            await run();
            await load(status);
            await Swal.fire({ icon: "success", title: done, timer: 1200, showConfirmButton: false });
        } catch (requestError) {
            const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "İşlem başarısız.";
            await Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally { setBusyId(null); }
    };

    const setStandingOf = async (row: AdminCoachApplicationView, next: "ACTIVE" | "PENDING" | "SUSPENDED") => {
        const wording = {
            ACTIVE: { title: "Koç hesabını aç", confirm: "Aç ve COACH rolünü ver", icon: "question" as const, placeholder: "Not (isteğe bağlı)" },
            PENDING: { title: "İncelemeye al", confirm: "İncelemeye al", icon: "warning" as const, placeholder: "Gerekçe — koça aynen gösterilecek" },
            SUSPENDED: { title: "Koç hesabını durdur", confirm: "Durdur ve rolü geri al", icon: "warning" as const, placeholder: "Gerekçe — koça aynen gösterilecek" },
        }[next];

        // Said out loud, because it is the part an admin will not guess: nothing is deleted. The
        // links stay, the students keep the Premium somebody already paid for, and the coach simply
        // cannot open anything until this is undone.
        const effect = next === "ACTIVE"
            ? "Paneli ve davet kodunu yeniden açar."
            : "Rolü geri alır, paneli kapatır ve elindeki davet kodlarını geçersizleştirir. Mevcut öğrenci bağlantıları ve koltuklar durur.";

        const result = await Swal.fire({
            title: wording.title,
            html: `<p class="text-start mb-2"><strong>${row.displayName || row.email}</strong><br><span class="text-muted">${effect}</span></p><textarea id="review-note" class="form-control mt-2" rows="3" placeholder="${wording.placeholder}"></textarea>`,
            icon: wording.icon,
            showCancelButton: true,
            confirmButtonText: wording.confirm,
            cancelButtonText: "Vazgeç",
            preConfirm: () => ({ reviewNote: (document.getElementById("review-note") as HTMLTextAreaElement | null)?.value.trim() || null }),
        });
        if (!result.isConfirmed || !result.value) return;

        await act(row, () => apiClient.post(`/admin/coaches/${row.userId}/status`, { status: next, ...result.value }), wording.title);
    };

    const verifyClaims = async (row: AdminCoachApplicationView) => {
        // Checkboxes rather than free text because the badge records WHICH claim was verified, and
        // an unchecked one is shown to students as the coach's own unverified word.
        const claimInputs = CLAIMS.map(({ value, label }) => {
            const declared = { INSTITUTION: row.institution, BRANCH: row.branch, YEARS: row.years !== null ? `${row.years} yıl` : null }[value];
            const checked = row.verifiedClaims.includes(value) ? " checked" : "";
            const disabled = declared ? "" : " disabled";
            return `<label class="d-block text-start${declared ? "" : " text-muted"}"><input type="checkbox" id="claim-${value}"${checked}${disabled}> ${label}${declared ? `: ${declared}` : " (beyan yok)"}</label>`;
        }).join("");

        const result = await Swal.fire({
            title: "Neyi doğruladın?",
            html: `<p class="text-start mb-2"><strong>${row.displayName || row.email}</strong><br><span class="text-muted">İşaretlemediklerin öğrenciye koçun kendi beyanı olarak gösterilir.</span></p>${claimInputs}`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Kaydet",
            cancelButtonText: "Vazgeç",
            preConfirm: () => ({ verifiedClaims: CLAIMS.filter(({ value }) => (document.getElementById(`claim-${value}`) as HTMLInputElement | null)?.checked).map(({ value }) => value) }),
        });
        if (!result.isConfirmed || !result.value) return;

        await act(row, () => apiClient.post(`/admin/coaches/${row.userId}/verified-claims`, result.value), "Kaydedildi");
    };

    const state = loading ? <AsyncState status="loading" title="Koçlar yükleniyor" /> : error ? <AsyncState status="error" title="Koçlar yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyin." onRetry={() => void load(status)} /> : rows.length === 0 ? <AsyncState status="empty" title={status === "ACTIVE" ? "Açık koç hesabı yok" : "Bu durumda koç yok"} /> : undefined;

    return <>
        <AdminPageHeader title="Koçlar" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Koçlar" }]} />
        <div className="main-content"><DataTableShell state={state} toolbar={<div className="admin-table-toolbar-content"><div><h2 className="h6 mb-1">Koç sicili</h2><span className="text-muted fs-12">Kayıt self servis. Buradan durdurabilir, açabilir ve iddiaları doğrulayabilirsin. {rows.length} kayıt.</span></div><div className="admin-table-search"><label className="visually-hidden" htmlFor="coach-status">Duruma göre süz</label><select id="coach-status" className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>{STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></div>}>
            <table className="table table-hover mb-0"><thead><tr><th>Koç</th><th>Beyanlar</th><th>Durum</th><th>Doğrulanan</th><th className="text-end">İşlemler</th></tr></thead><tbody>{rows.map((row) => <tr key={row.userId}>
                <td><div className="admin-table-primary">{row.displayName || "İsimsiz"}<span>{row.email}</span></div><div className="text-muted fs-12">{row.headline}</div></td>
                <td className="fs-12">{[row.institution, row.branch, row.years !== null ? `${row.years} yıl` : null].filter(Boolean).join(" · ") || <span className="text-muted">—</span>}</td>
                <td><StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge>
                    {/* The two-transaction gap, made visible instead of trusted. */}
                    {row.status === "ACTIVE" && !row.hasCoachRole && <StatusBadge tone="danger"><FiAlertTriangle aria-hidden="true" /> Rol verilmemiş</StatusBadge>}
                    {row.status !== "ACTIVE" && row.hasCoachRole && <StatusBadge tone="danger"><FiAlertTriangle aria-hidden="true" /> Rol hâlâ duruyor</StatusBadge>}</td>
                <td>{row.verifiedClaims.length === 0 ? <span className="text-muted">—</span> : row.verifiedClaims.map((claim) => <StatusBadge key={claim} tone="info">{CLAIMS.find((c) => c.value === claim)?.label ?? claim}</StatusBadge>)}</td>
                <td className="text-end"><div className="d-inline-flex gap-2">
                    <IconAction label="İddiaları doğrula" icon={<FiTag aria-hidden="true" />} tone="neutral" busy={busyId === row.userId} onClick={() => void verifyClaims(row)} />
                    {row.status === "ACTIVE"
                        ? <>
                            <IconAction label="İncelemeye al" icon={<FiPause aria-hidden="true" />} tone="neutral" busy={busyId === row.userId} onClick={() => void setStandingOf(row, "PENDING")} />
                            <IconAction label="Durdur" icon={<FiSlash aria-hidden="true" />} tone="danger" busy={busyId === row.userId} onClick={() => void setStandingOf(row, "SUSPENDED")} />
                        </>
                        : <IconAction label="Aç ve COACH rolünü ver" icon={<FiCheck aria-hidden="true" />} tone="success" busy={busyId === row.userId} onClick={() => void setStandingOf(row, "ACTIVE")} />}
                </div></td>
            </tr>)}</tbody></table>
        </DataTableShell></div>
    </>;
}

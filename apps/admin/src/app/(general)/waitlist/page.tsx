'use client'

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FiRefreshCw, FiSend, FiTrash2 } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { IconAction } from "@/components/shared/admin/IconAction";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import { useAuth } from "@/contentApi/authProvider";
import apiClient from "@/lib/apiClient";
import { canSee } from "@/lib/roles";
import type { Paginated } from "@mentor/types";
import type { AdminWaitlistEntry } from "@/lib/types";

const STATUSES = [
    { value: "", label: "Tüm durumlar" },
    { value: "waiting", label: "Bekliyor" },
    { value: "invited", label: "Davetli" },
] as const;

const ROLES = [
    { value: "student", label: "Öğrenci" },
    { value: "coach", label: "Koç" },
] as const;

const PAGE_SIZE = 20;

const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;
const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : null;
const escapeHtml = (value: string) => value.replace(/[<>&"']/g, "");

/** Known API error codes as plain Turkish; anything else falls back to the server message. */
const ERROR_MESSAGES: Record<string, string> = {
    WAITLIST_INVITE_LIMIT: "Açık davet tavanına ulaşıldı. Davet edilenlerin kayıt olmasını bekle ya da Ayarlar'dan tavanı yükselt.",
    WAITLIST_ENTRY_NOT_FOUND: "Kayıt bulunamadı. Silinmiş ya da kayıt olmuş olabilir, liste yenilendi.",
    AUTH_EMAIL_IN_USE: "Bu e-postayla zaten bir hesap var. Davet gerekmiyor, giriş yapabilir.",
};

const errorText = (requestError: unknown): string => {
    const data = (requestError as { response?: { data?: { code?: string; error?: { code?: string }; message?: string } } })?.response?.data;
    const code = data?.code ?? data?.error?.code;
    return (code && ERROR_MESSAGES[code]) || data?.message || "İşlem başarısız.";
};

/**
 * The invite-only signup list. People land here from the public waitlist form (or are typed in
 * below) and stay until someone invites them; the API purges the row after registration or after
 * the retention window. The page is in the menu for SUPER_ADMIN and SUPPORT only; every mutation is
 * SUPPORT (the umbrella admins pass too), so the buttons are hidden for anyone else.
 */
export default function WaitlistPage() {
    const { admin } = useAuth();
    const canMutate = canSee(["SUPPORT"], admin?.roles);

    const [rows, setRows] = useState<AdminWaitlistEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState("");
    const [role, setRole] = useState("");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"student" | "coach">("student");
    const [inviting, setInviting] = useState(false);

    // Typing settles for a moment before it becomes a request.
    useEffect(() => {
        const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const { data } = await apiClient.get<Paginated<AdminWaitlistEntry>>("/admin/waitlist", {
                params: { page, pageSize: PAGE_SIZE, ...(status && { status }), ...(role && { role }), ...(query && { q: query }) },
            });
            // The last row of the last page may have just left: step back instead of showing an empty list.
            if (data.items.length === 0 && page > 1) { setPage(page - 1); return; }
            setRows(data.items);
            setTotal(data.total);
        } catch {
            setRows([]);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [page, status, role, query]);

    useEffect(() => { void load(); }, [load]);

    const act = async (run: () => Promise<unknown>, done: string, id?: string) => {
        if (id) setBusyId(id);
        try {
            await run();
            await load();
            await Swal.fire({ icon: "success", title: done, timer: 1200, showConfirmButton: false });
            return true;
        } catch (requestError) {
            await Swal.fire({ icon: "error", title: "Olmadı", text: errorText(requestError) });
            void load();
            return false;
        } finally { if (id) setBusyId(null); }
    };

    const invite = (row: AdminWaitlistEntry) => act(() => apiClient.post(`/admin/waitlist/${row.id}/invite`), "Davet gönderildi", row.id);
    const resend = (row: AdminWaitlistEntry) => act(() => apiClient.post(`/admin/waitlist/${row.id}/resend`), "Davet yeniden gönderildi", row.id);

    const remove = async (row: AdminWaitlistEntry) => {
        const result = await Swal.fire({
            title: "Listeden sil",
            html: `<p class="text-start mb-0"><strong>${escapeHtml(row.email)}</strong><br><span class="text-muted">${row.status === "invited" ? "Daveti geçersiz kılar, bu adres artık kayıt olamaz." : "Bu adres listeden çıkar."}</span></p>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sil",
            cancelButtonText: "Vazgeç",
        });
        if (!result.isConfirmed) return;
        await act(() => apiClient.delete(`/admin/waitlist/${row.id}`), "Silindi", row.id);
    };

    const inviteByEmail = async (event: FormEvent) => {
        event.preventDefault();
        const email = inviteEmail.trim();
        if (!email) return;
        setInviting(true);
        const ok = await act(() => apiClient.post("/admin/waitlist/invite", { email, role: inviteRole, locale: "tr" }), "Davet gönderildi");
        setInviting(false);
        if (ok) setInviteEmail("");
    };

    const filtered = status !== "" || role !== "" || query !== "";
    const state = loading ? <AsyncState status="loading" title="Liste yükleniyor" />
        : error ? <AsyncState status="error" title="Liste yüklenemedi" description="Bağlantıyı kontrol edip yeniden dene." onRetry={() => void load()} />
        : rows.length === 0 ? <AsyncState status="empty" title={filtered ? "Bu süzgece uyan kayıt yok" : "Bekleme listesi boş"} />
        : undefined;

    return <>
        <AdminPageHeader title="Bekleme listesi" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Bekleme listesi" }]} />
        <div className="main-content">
            {canMutate && <form className="card mb-3" onSubmit={(event) => void inviteByEmail(event)}><div className="card-body d-flex flex-wrap align-items-end gap-2">
                <div className="flex-grow-1">
                    <label className="form-label fs-12 mb-1" htmlFor="waitlist-invite-email">E-postayla davet et</label>
                    <input id="waitlist-invite-email" type="email" required className="form-control" placeholder="ornek@eposta.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
                </div>
                <div>
                    <label className="form-label fs-12 mb-1" htmlFor="waitlist-invite-role">Rol</label>
                    <select id="waitlist-invite-role" className="form-select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "student" | "coach")}>{ROLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                </div>
                <button type="submit" className="btn btn-primary" disabled={inviting || !inviteEmail.trim()}>{inviting ? "Gönderiliyor" : "Davet et"}</button>
            </div></form>}
            <DataTableShell state={state} toolbar={<div className="admin-table-toolbar-content"><div><h2 className="h6 mb-1">Davet listesi</h2><span className="text-muted fs-12">Davetli modda yalnız buradan davet edilen adresler kayıt olur. {total} kayıt.</span></div>
                <div className="admin-table-search d-flex flex-wrap gap-2">
                    <label className="visually-hidden" htmlFor="waitlist-search">E-posta ara</label>
                    <input id="waitlist-search" type="search" className="form-control" placeholder="E-posta ara" value={search} onChange={(event) => setSearch(event.target.value)} />
                    <label className="visually-hidden" htmlFor="waitlist-status">Duruma göre süz</label>
                    <select id="waitlist-status" className="form-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>{STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                    <label className="visually-hidden" htmlFor="waitlist-role">Role göre süz</label>
                    <select id="waitlist-role" className="form-select" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">Tüm roller</option>{ROLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                </div></div>}>
                <table className="table table-hover mb-0"><thead><tr><th>E-posta</th><th>Rol</th><th>Durum</th><th>Katılım</th><th>Davet</th>{canMutate && <th className="text-end">İşlemler</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
                    <td><div className="admin-table-primary">{row.email}</div></td>
                    <td>{roleLabel(row.role)}</td>
                    <td><StatusBadge tone={row.status === "invited" ? "success" : "warning"}>{row.status === "invited" ? "Davetli" : "Bekliyor"}</StatusBadge></td>
                    <td className="fs-12">{formatDate(row.createdAt)}</td>
                    <td className="fs-12">{formatDate(row.invitedAt) ?? <span className="text-muted">-</span>}</td>
                    {canMutate && <td className="text-end"><div className="d-inline-flex gap-2">
                        {row.status === "waiting"
                            ? <IconAction label="Davet et" icon={<FiSend aria-hidden="true" />} tone="success" busy={busyId === row.id} onClick={() => void invite(row)} />
                            : <IconAction label="Yeniden gönder" icon={<FiRefreshCw aria-hidden="true" />} tone="neutral" busy={busyId === row.id} onClick={() => void resend(row)} />}
                        <IconAction label="Sil" icon={<FiTrash2 aria-hidden="true" />} tone="danger" busy={busyId === row.id} onClick={() => void remove(row)} />
                    </div></td>}
                </tr>)}</tbody></table>
                {total > PAGE_SIZE && <nav aria-label="Sayfalar" className="d-flex align-items-center justify-content-between gap-2 p-3 border-top">
                    <span className="text-muted fs-12">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}</span>
                    <div className="d-inline-flex gap-2">
                        <button type="button" className="btn btn-sm btn-light" disabled={page === 1} onClick={() => setPage(page - 1)}>Önceki</button>
                        <button type="button" className="btn btn-sm btn-light" disabled={page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Sonraki</button>
                    </div>
                </nav>}
            </DataTableShell>
        </div>
    </>;
}

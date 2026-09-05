'use client'

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FiSearch, FiShield, FiShieldOff, FiUser } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { IconAction } from "@/components/shared/admin/IconAction";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import { FILTERABLE_ROLES } from "@/lib/roles";
import type { AdminUserView } from "@/lib/types";

const statusTone = (status: string) => status === "ACTIVE" ? "success" as const : status === "SUSPENDED" ? "warning" as const : status === "BANNED" ? "danger" as const : "neutral" as const;
const statusLabel = (status: string) => status === "ACTIVE" ? "Aktif" : status === "SUSPENDED" ? "Askıda" : status === "BANNED" ? "Yasaklı" : status;

export default function UsersPage() {
    const [users, setUsers] = useState<AdminUserView[]>([]);
    const [query, setQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [role, setRole] = useState("");
    const [activeRole, setActiveRole] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    // `q` and `role` compose on the API, so both travel together and either may be empty.
    const load = useCallback(async (search: string, roleFilter: string) => {
        setLoading(true);
        setError(false);
        try {
            const params: Record<string, string> = {};
            if (search) params.q = search;
            if (roleFilter) params.role = roleFilter;
            const { data } = await apiClient.get<AdminUserView[]>("/admin/users", { params });
            setUsers(data);
            setActiveQuery(search);
            setActiveRole(roleFilter);
        } catch {
            setUsers([]);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load("", ""); }, [load]);
    const handleSearch = (event: FormEvent) => { event.preventDefault(); void load(query.trim(), role); };

    const toggleStaff = async (user: AdminUserView) => {
        const grant = !user.isStaff;
        const confirm = await Swal.fire({ title: grant ? "STAFF rolü verilsin mi?" : "STAFF rolü kaldırılsın mı?", text: grant ? `${user.email} her zaman Premium erişime sahip olacak.` : `${user.email} STAFF Premium erişimini kaybedecek.`, icon: "warning", showCancelButton: true, confirmButtonText: grant ? "Evet, ver" : "Evet, kaldır", cancelButtonText: "Vazgeç" });
        if (!confirm.isConfirmed) return;
        setBusyId(user.id);
        try {
            const url = `/admin/users/${user.id}/roles/staff`;
            const { data } = grant ? await apiClient.post<AdminUserView>(url) : await apiClient.delete<AdminUserView>(url);
            setUsers((current) => current.map((item) => item.id === data.id ? data : item));
            await Swal.fire({ icon: "success", title: "Güncellendi", timer: 1200, showConfirmButton: false });
        } catch (requestError) {
            const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "İşlem başarısız.";
            await Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally { setBusyId(null); }
    };

    const state = loading ? <AsyncState status="loading" title="Kullanıcılar yükleniyor" /> : error ? <AsyncState status="error" title="Kullanıcılar yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyin." onRetry={() => void load(activeQuery, activeRole)} /> : users.length === 0 ? <AsyncState status="empty" title={activeQuery || activeRole ? "Filtreyle eşleşen kullanıcı yok" : "Henüz kullanıcı yok"} description={activeRole && !activeQuery ? `${activeRole} rolünde kullanıcı bulunamadı.` : activeQuery ? "Arama ifadesini değiştirip yeniden deneyin." : undefined} /> : undefined;

    return <>
        <AdminPageHeader title="Kullanıcılar" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Kullanıcılar" }]} />
        <div className="main-content"><DataTableShell state={state} toolbar={<div className="admin-table-toolbar-content"><div><h2 className="h6 mb-1">Kullanıcı yönetimi</h2><span className="text-muted fs-12">{activeQuery || activeRole ? `${[activeRole && `${activeRole} rolü`, activeQuery && `“${activeQuery}”`].filter(Boolean).join(" · ")} için ${users.length} sonuç` : `${users.length} kullanıcı`}</span></div><form onSubmit={handleSearch} className="admin-table-search" role="search"><label className="visually-hidden" htmlFor="user-search">Kullanıcı ara</label><input id="user-search" type="search" className="form-control" placeholder="E-posta veya isim ara" value={query} onChange={(event) => setQuery(event.target.value)} /><label className="visually-hidden" htmlFor="user-role">Role göre süz</label><select id="user-role" className="form-select" value={role} onChange={(event) => { setRole(event.target.value); void load(query.trim(), event.target.value); }}><option value="">Tüm roller</option>{FILTERABLE_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}</select><button type="submit" className="btn btn-primary" disabled={loading}><FiSearch aria-hidden="true" /> Ara</button></form></div>}>
            <table className="table table-hover mb-0 users-table"><thead><tr><th>Kullanıcı</th><th>Roller</th><th>Durum</th><th>STAFF erişimi</th><th className="text-end">İşlemler</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="admin-table-primary">{user.displayName || "İsimsiz kullanıcı"}<span>{user.email}</span></div></td><td>{user.roles.map((role) => <StatusBadge key={role} tone="info">{role}</StatusBadge>)}</td><td><StatusBadge tone={statusTone(user.status)}>{statusLabel(user.status)}</StatusBadge></td><td><StatusBadge tone={user.isStaff ? "success" : "neutral"}>{user.isStaff ? "STAFF" : "Yok"}</StatusBadge></td><td className="text-end"><div className="d-inline-flex gap-2"><IconAction href={`/users/${user.id}`} label="Kullanıcı detayını aç" icon={<FiUser aria-hidden="true" />} /><IconAction label={user.isStaff ? "STAFF erişimini kaldır" : "STAFF erişimi ver"} icon={user.isStaff ? <FiShieldOff aria-hidden="true" /> : <FiShield aria-hidden="true" />} tone={user.isStaff ? "danger" : "success"} busy={busyId === user.id} onClick={() => void toggleStaff(user)} /></div></td></tr>)}</tbody></table>
        </DataTableShell></div>
    </>;
}

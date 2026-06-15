'use client'
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminUserView } from "@/lib/types";

// Admin user management (W6): search users and toggle the STAFF role. STAFF = always-premium
// entitlement without a subscription row (devnote 0015). Every change is audited server-side.
export default function UsersPage() {
    const [users, setUsers] = useState<AdminUserView[]>([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async (query: string) => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<AdminUserView[]>("/admin/users", {
                params: query ? { q: query } : {},
            });
            setUsers(data);
        } catch {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load("");
    }, [load]);

    const onSearch = (e: FormEvent) => {
        e.preventDefault();
        load(q.trim());
    };

    const toggleStaff = async (user: AdminUserView) => {
        const grant = !user.isStaff;
        const confirm = await Swal.fire({
            title: grant ? "STAFF rolü verilsin mi?" : "STAFF rolü kaldırılsın mı?",
            text: grant
                ? `${user.email} her zaman Premium erişime sahip olacak.`
                : `${user.email} STAFF Premium erişimini kaybedecek.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: grant ? "Evet, ver" : "Evet, kaldır",
            cancelButtonText: "Vazgeç",
        });
        if (!confirm.isConfirmed) return;

        setBusyId(user.id);
        try {
            const url = `/admin/users/${user.id}/roles/staff`;
            const { data } = grant
                ? await apiClient.post<AdminUserView>(url)
                : await apiClient.delete<AdminUserView>(url);
            setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)));
            Swal.fire({ icon: "success", title: "Güncellendi", timer: 1200, showConfirmButton: false });
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "İşlem başarısız.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <>
            <PageHeader>
                <div className="d-flex align-items-center gap-2">
                    <form onSubmit={onSearch} className="d-flex gap-2">
                        <input
                            type="search"
                            className="form-control"
                            placeholder="E-posta veya isim ara…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            style={{ minWidth: "240px" }}
                        />
                        <button type="submit" className="btn btn-primary">Ara</button>
                    </form>
                </div>
            </PageHeader>
            <div className="main-content">
                <div className="row">
                    <div className="col-12">
                        <div className="card stretch stretch-full">
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead>
                                            <tr>
                                                <th>E-posta</th>
                                                <th>İsim</th>
                                                <th>Roller</th>
                                                <th>Durum</th>
                                                <th>STAFF</th>
                                                <th className="text-end">İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading && (
                                                <tr><td colSpan={6} className="text-center py-4">Yükleniyor…</td></tr>
                                            )}
                                            {!loading && users.length === 0 && (
                                                <tr><td colSpan={6} className="text-center py-4 text-muted">Kayıt yok.</td></tr>
                                            )}
                                            {!loading && users.map((u) => (
                                                <tr key={u.id}>
                                                    <td>{u.email}</td>
                                                    <td>{u.displayName}</td>
                                                    <td>
                                                        {u.roles.map((r) => (
                                                            <span key={r} className="badge bg-soft-primary text-primary me-1">{r}</span>
                                                        ))}
                                                    </td>
                                                    <td>{u.status}</td>
                                                    <td>
                                                        {u.isStaff
                                                            ? <span className="badge bg-soft-success text-success">STAFF</span>
                                                            : <span className="badge bg-soft-secondary text-secondary">—</span>}
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="d-inline-flex gap-2">
                                                            <Link href={`/users/${u.id}`} className="btn btn-sm btn-light">Detay</Link>
                                                            <button
                                                                className={`btn btn-sm ${u.isStaff ? "btn-outline-danger" : "btn-outline-success"}`}
                                                                disabled={busyId === u.id}
                                                                onClick={() => toggleStaff(u)}
                                                            >
                                                                {busyId === u.id ? "…" : u.isStaff ? "STAFF kaldır" : "STAFF ver"}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

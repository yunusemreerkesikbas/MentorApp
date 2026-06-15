'use client'
import { useEffect, useState } from "react";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AuditEntry } from "@/lib/types";

// Admin audit log (W6, §9): newest-first trail of every admin mutation (who/what/when).
// Read-only — the trail is append-only on the server (no edit/delete).
export default function AuditLogPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        apiClient
            .get<AuditEntry[]>("/admin/audit-log")
            .then(({ data }) => { if (active) setEntries(data); })
            .catch(() => { if (active) setEntries([]); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const fmt = (iso: string) => new Date(iso).toLocaleString("tr-TR");
    const diff = (e: AuditEntry) => {
        const roles = (v: unknown) => (v as { roles?: string[] } | null)?.roles?.join(", ") ?? "—";
        return `${roles(e.before)} → ${roles(e.after)}`;
    };

    return (
        <>
            <PageHeader>{null}</PageHeader>
            <div className="main-content">
                <div className="row">
                    <div className="col-12">
                        <div className="card stretch stretch-full">
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead>
                                            <tr>
                                                <th>Tarih</th>
                                                <th>Eylem</th>
                                                <th>Hedef</th>
                                                <th>Değişim</th>
                                                <th>Yapan (actor)</th>
                                                <th>IP</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading && (
                                                <tr><td colSpan={6} className="text-center py-4">Yükleniyor…</td></tr>
                                            )}
                                            {!loading && entries.length === 0 && (
                                                <tr><td colSpan={6} className="text-center py-4 text-muted">Kayıt yok.</td></tr>
                                            )}
                                            {!loading && entries.map((e) => (
                                                <tr key={e.id}>
                                                    <td className="text-nowrap">{fmt(e.createdAt)}</td>
                                                    <td><span className="badge bg-soft-primary text-primary">{e.action}</span></td>
                                                    <td className="text-nowrap">{e.targetType ?? "—"} {e.targetId ? `· ${e.targetId.slice(0, 8)}` : ""}</td>
                                                    <td className="fs-12">{diff(e)}</td>
                                                    <td className="fs-12 text-nowrap">{e.actorUserId.slice(0, 8)}</td>
                                                    <td className="fs-12">{e.ip ?? "—"}</td>
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

'use client'
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminExam } from "@/lib/types";

// Admin exam-calendar list (W6). Editorial exams; events are managed on the edit page.
export default function ExamsPage() {
    const [items, setItems] = useState<AdminExam[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<{ items: AdminExam[] }>("/admin/content/exams", {
                params: { pageSize: 50 },
            });
            setItems(data.items);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <>
            <PageHeader>
                <Link href="/content/exams/new" className="btn btn-primary">+ Yeni sınav</Link>
            </PageHeader>
            <div className="main-content">
                <div className="card stretch stretch-full">
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead>
                                    <tr><th>Ad</th><th>Slug</th><th>Sınav</th><th>Tür</th><th>Güncel</th><th className="text-end">İşlem</th></tr>
                                </thead>
                                <tbody>
                                    {loading && <tr><td colSpan={6} className="text-center py-4">Yükleniyor…</td></tr>}
                                    {!loading && items.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted">Sınav yok.</td></tr>}
                                    {!loading && items.map((e) => (
                                        <tr key={e.id}>
                                            <td>{e.name}</td>
                                            <td className="fs-12 text-muted">{e.slug}</td>
                                            <td>{e.family}</td>
                                            <td className="fs-12">{e.variant ?? "—"}</td>
                                            <td>
                                                {e.isCurrent
                                                    ? <span className="badge bg-soft-success text-success">Güncel</span>
                                                    : <span className="badge bg-soft-secondary text-secondary">Arşiv</span>}
                                            </td>
                                            <td className="text-end">
                                                <Link href={`/content/exams/${e.slug}`} className="btn btn-sm btn-light">Düzenle</Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

'use client'
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminArticle } from "@/lib/types";

// Admin knowledge-center article list (W6). Drafts included; publish/unpublish inline.
export default function ArticlesPage() {
    const [items, setItems] = useState<AdminArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<{ items: AdminArticle[] }>("/admin/content/articles", {
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

    const toggle = async (a: AdminArticle) => {
        const action = a.isPublished ? "unpublish" : "publish";
        const confirm = await Swal.fire({
            title: a.isPublished ? "Yayından kaldırılsın mı?" : "Yayınlansın mı?",
            text: a.slug,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Evet",
            cancelButtonText: "Vazgeç",
        });
        if (!confirm.isConfirmed) return;
        setBusy(a.slug);
        try {
            const { data } = await apiClient.post<AdminArticle>(`/admin/content/articles/${a.slug}/${action}`);
            setItems((prev) => prev.map((x) => (x.slug === data.slug ? data : x)));
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "İşlem başarısız.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally {
            setBusy(null);
        }
    };

    return (
        <>
            <PageHeader>
                <Link href="/content/articles/new" className="btn btn-primary">+ Yeni makale</Link>
            </PageHeader>
            <div className="main-content">
                <div className="card stretch stretch-full">
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead>
                                    <tr><th>Başlık</th><th>Slug</th><th>Sınav</th><th>Kategori</th><th>Durum</th><th className="text-end">İşlem</th></tr>
                                </thead>
                                <tbody>
                                    {loading && <tr><td colSpan={6} className="text-center py-4">Yükleniyor…</td></tr>}
                                    {!loading && items.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted">Makale yok.</td></tr>}
                                    {!loading && items.map((a) => (
                                        <tr key={a.id}>
                                            <td>{a.title}</td>
                                            <td className="fs-12 text-muted">{a.slug}</td>
                                            <td>{a.family}</td>
                                            <td className="fs-12">{a.category}</td>
                                            <td>
                                                {a.isPublished
                                                    ? <span className="badge bg-soft-success text-success">Yayında</span>
                                                    : <span className="badge bg-soft-secondary text-secondary">Taslak</span>}
                                            </td>
                                            <td className="text-end">
                                                <div className="d-inline-flex gap-2">
                                                    <Link href={`/content/articles/${a.slug}`} className="btn btn-sm btn-light">Düzenle</Link>
                                                    <button
                                                        className={`btn btn-sm ${a.isPublished ? "btn-outline-danger" : "btn-outline-success"}`}
                                                        disabled={busy === a.slug}
                                                        onClick={() => toggle(a)}
                                                    >
                                                        {busy === a.slug ? "…" : a.isPublished ? "Yayından kaldır" : "Yayınla"}
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
        </>
    );
}

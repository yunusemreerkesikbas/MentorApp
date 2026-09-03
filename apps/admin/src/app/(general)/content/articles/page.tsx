'use client'
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiEdit2, FiEye, FiEyeOff, FiPlus } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { IconAction } from "@/components/shared/admin/IconAction";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { AdminArticle } from "@/lib/types";

type ArticleFilter = "all" | "published" | "draft";

export default function ArticlesPage() {
    const [items, setItems] = useState<AdminArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [filter, setFilter] = useState<ArticleFilter>("all");
    const load = useCallback(async () => { setLoading(true); setError(false); try { const { data } = await apiClient.get<{ items: AdminArticle[] }>("/admin/content/articles", { params: { pageSize: 50 } }); setItems(data.items); } catch { setItems([]); setError(true); } finally { setLoading(false); } }, []);
    useEffect(() => { void load(); }, [load]);
    const visibleItems = useMemo(() => items.filter((article) => filter === "all" || (filter === "published" ? article.isPublished : !article.isPublished)), [filter, items]);
    const toggle = async (article: AdminArticle) => {
        const action = article.isPublished ? "unpublish" : "publish";
        const confirm = await Swal.fire({ title: article.isPublished ? "Yayından kaldırılsın mı?" : "Yayınlansın mı?", text: article.slug, icon: "question", showCancelButton: true, confirmButtonText: "Evet", cancelButtonText: "Vazgeç" });
        if (!confirm.isConfirmed) return;
        setBusy(article.slug);
        try { const { data } = await apiClient.post<AdminArticle>(`/admin/content/articles/${article.slug}/${action}`); setItems((current) => current.map((item) => item.slug === data.slug ? data : item)); }
        catch (requestError) { const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "İşlem başarısız."; await Swal.fire({ icon: "error", title: "Hata", text: message }); }
        finally { setBusy(null); }
    };
    const state = loading ? <AsyncState status="loading" title="Makaleler yükleniyor" /> : error ? <AsyncState status="error" title="Makaleler yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyin." onRetry={() => void load()} /> : items.length === 0 ? <AsyncState status="empty" title="Henüz makale yok" description="Bilgi merkezinin ilk makalesini oluşturun." action={<Link href="/content/articles/new" className="btn btn-primary"><FiPlus aria-hidden="true" /> Yeni makale</Link>} /> : visibleItems.length === 0 ? <AsyncState status="empty" title="Bu durumda makale yok" description="Başka bir filtre seçebilirsiniz." /> : undefined;
    return <>
        <AdminPageHeader title="Makaleler" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Makaleler" }]} actions={<Link href="/content/articles/new" className="btn btn-primary"><FiPlus aria-hidden="true" /> Yeni makale</Link>} />
        <div className="main-content"><DataTableShell state={state} toolbar={<div className="admin-table-toolbar-content"><div><h2 className="h6 mb-1">Bilgi merkezi</h2><span className="text-muted fs-12">{items.length} makale</span></div><div className="admin-filter-group" role="group" aria-label="Yayın durumu filtresi">{([['all', 'Tümü'], ['published', 'Yayında'], ['draft', 'Taslak']] as const).map(([value, label]) => <button key={value} type="button" className={`btn btn-sm ${filter === value ? "btn-primary" : "btn-light"}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>}>
            <table className="table table-hover mb-0 article-table"><thead><tr><th>Makale</th><th>Kapsam</th><th>Doğrulama</th><th>Güncelleme</th><th>Durum</th><th className="text-end">İşlemler</th></tr></thead><tbody>{visibleItems.map((article) => <tr key={article.id}><td><div className="admin-table-primary">{article.title}<span>{article.slug}</span></div></td><td>{article.family}<span className="admin-table-secondary">{article.category}</span></td><td>{article.verifiedBy}<span className="admin-table-secondary">{new Date(article.verifiedAt).toLocaleDateString("tr-TR")}</span></td><td>{new Date(article.updatedAt).toLocaleDateString("tr-TR")}</td><td><StatusBadge tone={article.isPublished ? "success" : "neutral"}>{article.isPublished ? "Yayında" : "Taslak"}</StatusBadge>{article.isFeatured ? <span className="admin-table-secondary">Öne çıkan</span> : null}</td><td className="text-end"><div className="d-inline-flex gap-2"><IconAction href={`/content/articles/${article.slug}`} label="Makaleyi düzenle" icon={<FiEdit2 aria-hidden="true" />} /><IconAction label={article.isPublished ? "Yayından kaldır" : "Yayınla"} icon={article.isPublished ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />} tone={article.isPublished ? "danger" : "success"} busy={busy === article.slug} onClick={() => void toggle(article)} /></div></td></tr>)}</tbody></table>
        </DataTableShell></div>
    </>;
}

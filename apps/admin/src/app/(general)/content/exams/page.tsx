"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { IconAction } from "@/components/shared/admin/IconAction";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { AdminExam } from "@/lib/types";

type ExamFilter = "all" | "current" | "archived";

const VARIANT_LABELS: Record<string, string> = {
    LISANS: "Lisans",
    ONLISANS: "Ön lisans",
    ORTAOGRETIM: "Ortaöğretim",
};

function errorMessage(error: unknown): string {
    return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Sınavlar yüklenemedi.";
}

function formatUpdatedAt(value: string): string {
    return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

// Editorial exam list. Calendar events remain scoped to the edit page.
export default function ExamsPage() {
    const [items, setItems] = useState<AdminExam[]>([]);
    const [filter, setFilter] = useState<ExamFilter>("all");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const { data } = await apiClient.get<{ items: AdminExam[] }>("/admin/content/exams", { params: { pageSize: 50 } });
            setItems(data.items);
        } catch (error) {
            setLoadError(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const currentCount = useMemo(() => items.filter((item) => item.isCurrent).length, [items]);
    const archivedCount = items.length - currentCount;
    const filteredItems = useMemo(
        () => items.filter((item) => filter === "all" || (filter === "current" ? item.isCurrent : !item.isCurrent)),
        [filter, items],
    );

    const tableState = loading ? (
        <AsyncState status="loading" title="Sınavlar yükleniyor" />
    ) : loadError ? (
        <AsyncState status="error" title="Sınavlar yüklenemedi" description={loadError} onRetry={() => void load()} />
    ) : filteredItems.length === 0 ? (
        <AsyncState
            status="empty"
            title={items.length === 0 ? "Henüz sınav yok" : "Bu durumda sınav yok"}
            description={items.length === 0 ? "İlk sınavı oluşturarak resmi takvimi yönetmeye başlayabilirsin." : "Başka bir durum filtresi seçebilirsin."}
            action={items.length === 0 ? <Link href="/content/exams/new" className="btn btn-primary"><FiPlus aria-hidden="true" /><span>Yeni sınav</span></Link> : undefined}
        />
    ) : undefined;

    return (
        <>
            <AdminPageHeader
                title="Sınavlar"
                breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Sınavlar" }]}
                actions={<Link href="/content/exams/new" className="btn btn-primary"><FiPlus aria-hidden="true" /><span>Yeni sınav</span></Link>}
            />
            <div className="main-content">
                <DataTableShell
                    state={tableState}
                    toolbar={
                        <div className="admin-table-toolbar-content">
                            <div className="admin-filter-group" role="group" aria-label="Sınav durumu">
                                {(
                                    [
                                        ["all", "Tümü", items.length],
                                        ["current", "Güncel", currentCount],
                                        ["archived", "Arşiv", archivedCount],
                                    ] as const
                                ).map(([value, label, count]) => (
                                    <button type="button" className={`btn btn-sm ${filter === value ? "btn-primary" : "btn-light"}`} aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>
                                        {label} <span className="admin-filter-count">{count}</span>
                                    </button>
                                ))}
                            </div>
                            {!loading && !loadError ? <span className="text-muted fs-12">{filteredItems.length} sınav</span> : null}
                        </div>
                    }
                >
                    {filteredItems.length > 0 && !loading && !loadError ? (
                        <table className="table table-hover align-middle mb-0 admin-data-table exam-table">
                            <thead><tr><th>Sınav</th><th>Kapsam</th><th>Net kuralı</th><th>Güncelleme</th><th>Durum</th><th><span className="visually-hidden">İşlemler</span></th></tr></thead>
                            <tbody>
                                {filteredItems.map((item) => (
                                    <tr key={item.id}>
                                        <td className="admin-table-primary"><Link href={`/content/exams/${item.slug}`}>{item.name}</Link><span>{item.slug}</span></td>
                                        <td><strong>{item.family}</strong><span className="admin-table-secondary">{item.variant ? VARIANT_LABELS[item.variant] ?? item.variant : "Genel"}</span></td>
                                        <td>Her {item.netRule.divisor} yanlış 1 doğruyu götürür</td>
                                        <td className="text-nowrap">{formatUpdatedAt(item.updatedAt)}</td>
                                        <td><StatusBadge tone={item.isCurrent ? "success" : "neutral"}>{item.isCurrent ? "Güncel" : "Arşiv"}</StatusBadge></td>
                                        <td className="text-end"><IconAction href={`/content/exams/${item.slug}`} label={`${item.name} sınavını düzenle`} icon={<FiEdit2 />} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : null}
                </DataTableShell>
            </div>
        </>
    );
}

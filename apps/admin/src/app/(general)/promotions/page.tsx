"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiEdit2, FiPauseCircle, FiPlayCircle, FiPlus } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { IconAction } from "@/components/shared/admin/IconAction";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { AdminPromotion } from "@/lib/types";

const RULE_LABEL: Record<AdminPromotion["ruleType"], string> = {
    ANYONE: "Herkes",
    NEW_USER: "Yeni kayıt",
    ACTIVE_DAYS: "Aktif gün",
    WIN_BACK: "Geri kazanım",
};

type PromotionFilter = "all" | "active" | "inactive";

function errorMessage(err: unknown): string {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Kampanyalar yüklenemedi."
    );
}

function formatDiscount(row: AdminPromotion): string {
    return row.discountType === "PERCENT"
        ? `%${row.discountValue}`
        : (row.discountValue / 100).toLocaleString("tr-TR", {
              style: "currency",
              currency: "TRY",
          });
}

function formatWindow(row: AdminPromotion): string {
    const fmt = (iso: string) => new Date(iso).toLocaleDateString("tr-TR");
    if (row.startsAt && row.endsAt) return `${fmt(row.startsAt)} – ${fmt(row.endsAt)}`;
    if (row.endsAt) return `${fmt(row.endsAt)} tarihine kadar`;
    if (row.startsAt) return `${fmt(row.startsAt)} tarihinden itibaren`;
    return "Süresiz";
}

function formatUsage(row: AdminPromotion): string {
    return row.maxRedemptions === null
        ? `${row.redeemedCount} / ∞`
        : `${row.redeemedCount} / ${row.maxRedemptions}`;
}

export default function PromotionsPage() {
    const [items, setItems] = useState<AdminPromotion[]>([]);
    const [filter, setFilter] = useState<PromotionFilter>("all");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const { data } = await apiClient.get<AdminPromotion[]>("/admin/promotions");
            setItems(data);
        } catch (error) {
            setLoadError(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function toggleActive(item: AdminPromotion) {
        const next = !item.isActive;
        if (!next) {
            const confirmed = await Swal.fire({
                icon: "warning",
                title: "Kampanyayı durdur",
                text: `“${item.name}” bundan sonra hiçbir ödemeye uygulanmaz. Kullanılmış indirimler geçerli kalır.`,
                showCancelButton: true,
                confirmButtonText: "Kampanyayı durdur",
                cancelButtonText: "Yayında tut",
            });
            if (!confirmed.isConfirmed) return;
        }

        setBusyId(item.id);
        try {
            const { data } = await apiClient.patch<AdminPromotion>(
                `/admin/promotions/${item.id}`,
                { isActive: next },
            );
            setItems((current) => current.map((row) => (row.id === data.id ? data : row)));
            await Swal.fire({
                icon: "success",
                title: next ? "Kampanya yayına alındı" : "Kampanya durduruldu",
                timer: 1200,
                showConfirmButton: false,
            });
        } catch (error) {
            await Swal.fire({
                icon: "error",
                title: "İşlem tamamlanamadı",
                text: errorMessage(error),
            });
            await load();
        } finally {
            setBusyId(null);
        }
    }

    const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items]);
    const inactiveCount = items.length - activeCount;
    const filteredItems = useMemo(
        () =>
            items.filter((item) => {
                if (filter === "active") return item.isActive;
                if (filter === "inactive") return !item.isActive;
                return true;
            }),
        [filter, items],
    );

    const tableState = loading ? (
        <AsyncState status="loading" title="Kampanyalar yükleniyor" />
    ) : loadError ? (
        <AsyncState
            status="error"
            title="Kampanyalar yüklenemedi"
            description={loadError}
            onRetry={() => void load()}
        />
    ) : filteredItems.length === 0 ? (
        <AsyncState
            status="empty"
            title={items.length === 0 ? "Henüz kampanya yok" : "Bu durumda kampanya yok"}
            description={
                items.length === 0
                    ? "İlk kampanyayı oluşturarak indirim akışını başlatabilirsin."
                    : "Başka bir durum filtresi seçebilirsin."
            }
            action={
                items.length === 0 ? (
                    <Link href="/promotions/new" className="btn btn-primary">
                        <FiPlus aria-hidden="true" />
                        <span>Yeni kampanya</span>
                    </Link>
                ) : undefined
            }
        />
    ) : undefined;

    return (
        <>
            <AdminPageHeader
                title="Kampanyalar"
                breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Kampanyalar" }]}
                actions={
                    <Link href="/promotions/new" className="btn btn-primary">
                        <FiPlus aria-hidden="true" />
                        <span>Yeni kampanya</span>
                    </Link>
                }
            />

            <div className="main-content">
                <DataTableShell
                    state={tableState}
                    toolbar={
                        <div className="admin-table-toolbar-content">
                            <div className="admin-filter-group" role="group" aria-label="Kampanya durumu">
                                {(
                                    [
                                        ["all", "Tümü", items.length],
                                        ["active", "Yayında", activeCount],
                                        ["inactive", "Durduruldu", inactiveCount],
                                    ] as const
                                ).map(([value, label, count]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`btn btn-sm ${filter === value ? "btn-primary" : "btn-light"}`}
                                        aria-pressed={filter === value}
                                        onClick={() => setFilter(value)}
                                    >
                                        {label} <span className="admin-filter-count">{count}</span>
                                    </button>
                                ))}
                            </div>
                            {!loading && !loadError ? (
                                <span className="text-muted fs-12" aria-live="polite">
                                    {filteredItems.length} kampanya
                                </span>
                            ) : null}
                        </div>
                    }
                >
                    {filteredItems.length > 0 && !loading && !loadError ? (
                        <table className="table table-hover align-middle mb-0 admin-data-table promotion-table">
                            <thead>
                                <tr>
                                    <th>Kampanya</th>
                                    <th>Hedef kitle</th>
                                    <th>Teklif</th>
                                    <th>Kullanım</th>
                                    <th>Tarih aralığı</th>
                                    <th>Durum</th>
                                    <th><span className="visually-hidden">İşlemler</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item) => (
                                    <tr key={item.id}>
                                        <td className="admin-table-primary">
                                            <Link href={`/promotions/${item.id}`}>{item.name}</Link>
                                            <span>{item.labelTr}</span>
                                            <span>{item.code ? item.code : "Otomatik uygulanır"}</span>
                                        </td>
                                        <td>{RULE_LABEL[item.ruleType]}</td>
                                        <td>
                                            <strong>{formatDiscount(item)}</strong>
                                            <span className="admin-table-secondary">
                                                {item.appliesToPeriods === 1
                                                    ? "İlk tahsilat"
                                                    : `${item.appliesToPeriods} dönem`}
                                            </span>
                                        </td>
                                        <td>{formatUsage(item)}</td>
                                        <td className="text-nowrap">{formatWindow(item)}</td>
                                        <td>
                                            <StatusBadge tone={item.isActive ? "success" : "neutral"}>
                                                {item.isActive ? "Yayında" : "Durduruldu"}
                                            </StatusBadge>
                                        </td>
                                        <td className="text-end">
                                            <div className="d-inline-flex gap-2">
                                                <IconAction
                                                    href={`/promotions/${item.id}`}
                                                    label={`${item.name} kampanyasını düzenle`}
                                                    icon={<FiEdit2 />}
                                                    disabled={busyId !== null}
                                                />
                                                <IconAction
                                                    label={item.isActive ? `${item.name} kampanyasını durdur` : `${item.name} kampanyasını yayına al`}
                                                    icon={item.isActive ? <FiPauseCircle /> : <FiPlayCircle />}
                                                    tone={item.isActive ? "danger" : "success"}
                                                    busy={busyId === item.id}
                                                    disabled={busyId !== null && busyId !== item.id}
                                                    onClick={() => void toggleActive(item)}
                                                />
                                            </div>
                                        </td>
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

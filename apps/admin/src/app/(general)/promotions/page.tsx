"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminPromotion } from "@/lib/types";

const RULE_LABEL: Record<AdminPromotion["ruleType"], string> = {
    ANYONE: "Herkes",
    NEW_USER: "Yeni kayıt",
    ACTIVE_DAYS: "Aktif gün",
    WIN_BACK: "Geri kazanım",
};

function errorMessage(err: unknown): string {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "İşlem tamamlanamadı."
    );
}

function formatDiscount(row: AdminPromotion): string {
    return row.discountType === "PERCENT"
        ? `%${row.discountValue}`
        : `${(row.discountValue / 100).toLocaleString("tr-TR", {
              style: "currency",
              currency: "TRY",
          })}`;
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
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<AdminPromotion[]>("/admin/promotions");
            setItems(data);
        } catch {
            setItems([]);
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
                text: `"${item.name}" bundan sonra hiçbir ödemeye uygulanmaz. Kullanılmış indirimler geçerli kalır.`,
                showCancelButton: true,
                confirmButtonText: "Durdur",
                cancelButtonText: "Vazgeç",
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
            Swal.fire({
                icon: "success",
                title: next ? "Yayında" : "Durduruldu",
                timer: 1200,
                showConfirmButton: false,
            });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errorMessage(err) });
            await load();
        } finally {
            setBusyId(null);
        }
    }

    return (
        <>
            <PageHeader>
                <Link href="/promotions/new" className="btn btn-primary">
                    Yeni kampanya
                </Link>
            </PageHeader>

            <div className="nxl-content">
                <div className="row">
                    <div className="col-12">
                        <div className="card stretch stretch-full">
                            <div className="card-body p-0">
                                {loading ? (
                                    <div className="text-center py-5">Yükleniyor…</div>
                                ) : items.length === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        Henüz kampanya yok.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-hover mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Ad</th>
                                                    <th>Kod</th>
                                                    <th>Kural</th>
                                                    <th>İndirim</th>
                                                    <th>Dönem</th>
                                                    <th>Kullanım</th>
                                                    <th>Tarih</th>
                                                    <th>Durum</th>
                                                    <th />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item.id}>
                                                        <td>
                                                            <Link href={`/promotions/${item.id}`}>
                                                                {item.name}
                                                            </Link>
                                                            <div className="fs-12 text-muted">
                                                                {item.labelTr}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {item.code ? (
                                                                <code>{item.code}</code>
                                                            ) : (
                                                                <span className="fs-12 text-muted">
                                                                    Otomatik
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="fs-12">
                                                            {RULE_LABEL[item.ruleType]}
                                                        </td>
                                                        <td className="fw-bold">
                                                            {formatDiscount(item)}
                                                        </td>
                                                        <td className="fs-12">
                                                            {item.appliesToPeriods === 1
                                                                ? "İlk tahsilat"
                                                                : `${item.appliesToPeriods} dönem`}
                                                        </td>
                                                        <td className="fs-12">
                                                            {formatUsage(item)}
                                                        </td>
                                                        <td className="fs-12 text-muted">
                                                            {formatWindow(item)}
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={`badge ${
                                                                    item.isActive
                                                                        ? "bg-soft-success"
                                                                        : "bg-soft-secondary"
                                                                }`}
                                                            >
                                                                {item.isActive
                                                                    ? "Yayında"
                                                                    : "Durduruldu"}
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            <button
                                                                type="button"
                                                                className={`btn btn-sm ${
                                                                    item.isActive
                                                                        ? "btn-outline-danger"
                                                                        : "btn-light"
                                                                }`}
                                                                disabled={busyId === item.id}
                                                                onClick={() =>
                                                                    void toggleActive(item)
                                                                }
                                                            >
                                                                {item.isActive
                                                                    ? "Durdur"
                                                                    : "Yayına al"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

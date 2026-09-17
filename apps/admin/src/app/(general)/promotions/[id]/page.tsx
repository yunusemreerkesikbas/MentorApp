"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import apiClient from "@/lib/apiClient";
import type { AdminPromotion } from "@/lib/types";
import PromotionForm from "../PromotionForm";

function errorMessage(err: unknown): string {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Kampanya bilgileri yüklenemedi."
    );
}

export default function EditPromotionPage() {
    const { id } = useParams<{ id: string }>();
    const [promotion, setPromotion] = useState<AdminPromotion | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const { data } = await apiClient.get<AdminPromotion>(`/admin/promotions/${id}`);
            setPromotion(data);
        } catch (error) {
            setPromotion(null);
            setLoadError(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <>
            <AdminPageHeader
                title="Kampanyayı düzenle"
                breadcrumbs={[
                    { label: "Panel", href: "/" },
                    { label: "Kampanyalar", href: "/promotions" },
                    { label: promotion?.name ?? "Düzenle" },
                ]}
                actions={
                    <Link href="/promotions" className="btn btn-light">
                        <FiArrowLeft aria-hidden="true" />
                        <span>Kampanyalara dön</span>
                    </Link>
                }
            />

            {loading ? (
                <div className="main-content">
                    <div className="row g-4" aria-busy="true">
                        <div className="col-xl-6">
                            <div className="card stretch stretch-full">
                                <div className="card-body">
                                    <AsyncState status="loading" size="compact" title="Kampanya yükleniyor" />
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-6">
                            <div className="card stretch stretch-full">
                                <div className="card-body">
                                    <AsyncState status="loading" size="compact" title="Kampanya yükleniyor" />
                                </div>
                            </div>
                        </div>
                        <div className="col-12">
                            <div className="card stretch stretch-full">
                                <div className="card-body">
                                    <AsyncState status="loading" size="compact" title="Kampanya yükleniyor" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : loadError ? (
                <div className="main-content">
                    <div className="card stretch stretch-full">
                        <AsyncState status="error" title="Kampanya yüklenemedi" description={loadError} onRetry={() => void load()} />
                    </div>
                </div>
            ) : promotion ? (
                <PromotionForm initial={promotion} />
            ) : (
                <div className="main-content">
                    <div className="card stretch stretch-full">
                        <AsyncState status="empty" title="Kampanya bulunamadı" description="Kampanya silinmiş veya erişimin kaldırılmış olabilir." />
                    </div>
                </div>
            )}
        </>
    );
}

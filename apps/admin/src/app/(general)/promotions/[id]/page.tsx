"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminPromotion } from "@/lib/types";
import PromotionForm from "../PromotionForm";

export default function EditPromotionPage() {
    const { id } = useParams<{ id: string }>();
    const [promotion, setPromotion] = useState<AdminPromotion | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        apiClient
            .get<AdminPromotion>(`/admin/promotions/${id}`)
            .then(({ data }) => {
                if (active) setPromotion(data);
            })
            .catch(() => {
                if (active) setPromotion(null);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [id]);

    return (
        <>
            <PageHeader>
                <Link href="/promotions" className="btn btn-light">
                    ← Kampanyalar
                </Link>
            </PageHeader>
            {loading ? (
                <div className="nxl-content">
                    <div className="text-center py-5">Yükleniyor…</div>
                </div>
            ) : promotion ? (
                <>
                    <div className="nxl-content pb-0">
                        <div className="card stretch stretch-full">
                            <div className="card-body py-3">
                                <span className="fs-12 text-muted">
                                    Kullanım: <strong>{promotion.redeemedCount}</strong>
                                    {promotion.maxRedemptions === null
                                        ? " (sınırsız)"
                                        : ` / ${promotion.maxRedemptions}`}
                                    {" · "}
                                    Oluşturma:{" "}
                                    {new Date(promotion.createdAt).toLocaleString("tr-TR")}
                                </span>
                            </div>
                        </div>
                    </div>
                    <PromotionForm initial={promotion} />
                </>
            ) : (
                <div className="nxl-content">
                    <div className="text-center py-5 text-muted">Kampanya bulunamadı.</div>
                </div>
            )}
        </>
    );
}

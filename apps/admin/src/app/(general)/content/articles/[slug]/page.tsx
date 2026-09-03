'use client'
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import apiClient from "@/lib/apiClient";
import type { AdminArticle } from "@/lib/types";
import ArticleForm from "../ArticleForm";

export default function EditArticlePage() {
    const params = useParams<{ slug: string }>();
    const [article, setArticle] = useState<AdminArticle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const { data } = await apiClient.get<AdminArticle>(`/admin/content/articles/${params.slug}`);
            setArticle(data);
        } catch {
            setArticle(null);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [params.slug]);

    useEffect(() => { void load(); }, [load]);

    return (
        <>
            <AdminPageHeader title="Makaleyi düzenle" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Makaleler", href: "/content/articles" }, { label: article?.title ?? "Düzenle" }]} actions={<Link href="/content/articles" className="btn btn-light"><FiArrowLeft aria-hidden="true" /> Makaleler</Link>} />
            <div className="main-content">
                {loading && <AsyncState status="loading" title="Makale yükleniyor" />}
                {!loading && error && <AsyncState status="error" title="Makale yüklenemedi" description="Kayıt bulunamadı veya bağlantı kurulamadı." onRetry={() => void load()} />}
                {!loading && article && <ArticleForm initial={article} />}
            </div>
        </>
    );
}

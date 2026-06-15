'use client'
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminArticle } from "@/lib/types";
import ArticleForm from "../ArticleForm";

export default function EditArticlePage() {
    const params = useParams<{ slug: string }>();
    const [article, setArticle] = useState<AdminArticle | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        apiClient
            .get<AdminArticle>(`/admin/content/articles/${params.slug}`)
            .then(({ data }) => { if (active) setArticle(data); })
            .catch(() => { if (active) setArticle(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [params.slug]);

    return (
        <>
            <PageHeader>
                <Link href="/content/articles" className="btn btn-light">← Makaleler</Link>
            </PageHeader>
            <div className="main-content">
                {loading && <div className="text-center py-5">Yükleniyor…</div>}
                {!loading && !article && <div className="text-center py-5 text-muted">Makale bulunamadı.</div>}
                {!loading && article && <ArticleForm initial={article} />}
            </div>
        </>
    );
}

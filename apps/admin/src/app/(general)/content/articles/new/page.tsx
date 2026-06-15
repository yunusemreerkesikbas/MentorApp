'use client'
import Link from "next/link";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import ArticleForm from "../ArticleForm";

export default function NewArticlePage() {
    return (
        <>
            <PageHeader>
                <Link href="/content/articles" className="btn btn-light">← Makaleler</Link>
            </PageHeader>
            <div className="main-content">
                <ArticleForm />
            </div>
        </>
    );
}

'use client'
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import ArticleForm from "../ArticleForm";

export default function NewArticlePage() {
    return (
        <>
            <AdminPageHeader title="Yeni makale" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Makaleler", href: "/content/articles" }, { label: "Yeni" }]} actions={<Link href="/content/articles" className="btn btn-light"><FiArrowLeft aria-hidden="true" /> Makaleler</Link>} />
            <div className="main-content">
                <ArticleForm />
            </div>
        </>
    );
}

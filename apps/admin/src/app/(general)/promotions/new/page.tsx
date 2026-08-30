"use client";

import Link from "next/link";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import PromotionForm from "../PromotionForm";

export default function NewPromotionPage() {
    return (
        <>
            <PageHeader>
                <Link href="/promotions" className="btn btn-light">
                    ← Kampanyalar
                </Link>
            </PageHeader>
            <PromotionForm />
        </>
    );
}

"use client";

import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import PromotionForm from "../PromotionForm";

export default function NewPromotionPage() {
    return (
        <>
            <AdminPageHeader
                title="Yeni kampanya"
                breadcrumbs={[
                    { label: "Panel", href: "/" },
                    { label: "Kampanyalar", href: "/promotions" },
                    { label: "Yeni kampanya" },
                ]}
                actions={
                    <Link href="/promotions" className="btn btn-light">
                        <FiArrowLeft aria-hidden="true" />
                        <span>Kampanyalara dön</span>
                    </Link>
                }
            />
            <PromotionForm />
        </>
    );
}

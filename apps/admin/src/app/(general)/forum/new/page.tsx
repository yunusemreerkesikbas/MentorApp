import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import ZoneForm from "../ZoneForm";

export default function NewZonePage() {
    return (
        <>
            <AdminPageHeader title="Yeni topluluk odası" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Topluluk", href: "/forum" }, { label: "Yeni oda" }]} actions={<Link href="/forum" className="btn btn-light"><FiArrowLeft aria-hidden="true" /> Topluluk</Link>} />
            <div className="main-content">
                <div className="row">
                    <div className="col-lg-8">
                        <ZoneForm />
                    </div>
                </div>
            </div>
        </>
    );
}

import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import ExamForm from "../ExamForm";

export default function NewExamPage() {
    return (
        <>
            <AdminPageHeader
                title="Yeni sınav"
                breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Sınavlar", href: "/content/exams" }, { label: "Yeni sınav" }]}
                actions={<Link href="/content/exams" className="btn btn-light"><FiArrowLeft aria-hidden="true" /><span>Sınavlar</span></Link>}
            />
            <div className="main-content">
                <ExamForm />
            </div>
        </>
    );
}

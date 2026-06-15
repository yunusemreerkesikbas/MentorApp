'use client'
import Link from "next/link";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import ExamForm from "../ExamForm";

export default function NewExamPage() {
    return (
        <>
            <PageHeader>
                <Link href="/content/exams" className="btn btn-light">← Sınavlar</Link>
            </PageHeader>
            <div className="main-content">
                <ExamForm />
            </div>
        </>
    );
}

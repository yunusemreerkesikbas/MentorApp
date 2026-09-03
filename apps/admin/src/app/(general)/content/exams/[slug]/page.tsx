'use client'
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import apiClient from "@/lib/apiClient";
import type { AdminExamDetail, AdminExamEvent } from "@/lib/types";
import ExamForm from "../ExamForm";
import EventsEditor from "../EventsEditor";

export default function EditExamPage() {
    const params = useParams<{ slug: string }>();
    const [detail, setDetail] = useState<AdminExamDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const { data } = await apiClient.get<AdminExamDetail>(`/admin/content/exams/${params.slug}`);
            setDetail(data);
        } catch (error) {
            setDetail(null);
            setLoadError((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Sınav bilgileri yüklenemedi.");
        } finally {
            setLoading(false);
        }
    }, [params.slug]);

    useEffect(() => { void load(); }, [load]);

    const onEventsChange = (events: AdminExamEvent[]) =>
        setDetail((prev) => (prev ? { ...prev, events } : prev));

    return (
        <>
            <AdminPageHeader
                title={detail?.exam.name ?? "Sınavı düzenle"}
                breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Sınavlar", href: "/content/exams" }, { label: detail?.exam.name ?? "Düzenle" }]}
                actions={<Link href="/content/exams" className="btn btn-light"><FiArrowLeft aria-hidden="true" /><span>Sınavlar</span></Link>}
            />
            <div className="main-content">
                {loading ? <div className="card"><AsyncState status="loading" title="Sınav bilgileri yükleniyor" /></div> : null}
                {!loading && loadError ? <div className="card"><AsyncState status="error" title="Sınav bilgileri yüklenemedi" description={loadError} onRetry={() => void load()} /></div> : null}
                {!loading && detail && (
                    <>
                        <ExamForm initial={detail.exam} />
                        <EventsEditor slug={detail.exam.slug} events={detail.events} onChange={onEventsChange} />
                    </>
                )}
            </div>
        </>
    );
}

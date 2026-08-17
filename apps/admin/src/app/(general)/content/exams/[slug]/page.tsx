'use client'
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminExamDetail, AdminExamEvent } from "@/lib/types";
import ExamForm from "../ExamForm";
import EventsEditor from "../EventsEditor";

export default function EditExamPage() {
    const params = useParams<{ slug: string }>();
    const [detail, setDetail] = useState<AdminExamDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        apiClient
            .get<AdminExamDetail>(`/admin/content/exams/${params.slug}`)
            .then(({ data }) => {
                // #region agent log
                fetch("http://127.0.0.1:7497/ingest/21f8ef43-7e17-46b1-8c00-47111ca62dd3", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "54e609" },
                    body: JSON.stringify({
                        sessionId: "54e609",
                        runId: "pre-fix",
                        hypothesisId: "H4",
                        location: "exams/[slug]/page.tsx:useEffect",
                        message: "Admin exam detail GET in browser",
                        data: {
                            paramSlug: params.slug,
                            examSlug: data?.exam?.slug ?? null,
                            eventCount: data?.events?.length ?? null,
                            events: (data?.events ?? []).map((e) => ({
                                type: e.type,
                                eventAt: e.eventAt,
                                verifiedBy: e.verifiedBy,
                            })),
                        },
                        timestamp: Date.now(),
                    }),
                }).catch(() => {});
                // #endregion
                if (active) setDetail(data);
            })
            .catch(() => { if (active) setDetail(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [params.slug]);

    const onEventsChange = (events: AdminExamEvent[]) =>
        setDetail((prev) => (prev ? { ...prev, events } : prev));

    return (
        <>
            <PageHeader>
                <Link href="/content/exams" className="btn btn-light">← Sınavlar</Link>
            </PageHeader>
            <div className="main-content">
                {loading && <div className="text-center py-5">Yükleniyor…</div>}
                {!loading && !detail && <div className="text-center py-5 text-muted">Sınav bulunamadı.</div>}
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

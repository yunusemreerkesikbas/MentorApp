'use client'
import { useEffect, useState, type FormEvent } from "react";
import Swal from "sweetalert2";
import apiClient from "@/lib/apiClient";
import type { AdminExamDetail, AdminExamEvent } from "@/lib/types";

const EVENT_TYPES = ["EXAM_DATE", "APPLICATION_START", "APPLICATION_END", "RESULT_DATE"];

const toLocalInput = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function formFromEvents(events: AdminExamEvent[], type: string) {
    const existing = events.find((x) => x.type === type);
    return {
        type,
        eventAt: toLocalInput(existing?.eventAt),
        source: existing?.source ?? "",
        sourceUrl: existing?.sourceUrl ?? "",
        verifiedBy: existing?.verifiedBy ?? "",
        verifiedAt: toLocalInput(existing?.verifiedAt),
    };
}

// Calendar events editor for one exam (§4 #1): trust metadata required; upsert by (exam, type).
export default function EventsEditor({ slug, events, onChange }: {
    slug: string;
    events: AdminExamEvent[];
    onChange: (events: AdminExamEvent[]) => void;
}) {
    const [f, setF] = useState(() => formFromEvents(events, "EXAM_DATE"));
    useEffect(() => {
        const hydrated = formFromEvents(events, "EXAM_DATE");
        // #region agent log
        fetch("http://127.0.0.1:7497/ingest/21f8ef43-7e17-46b1-8c00-47111ca62dd3", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "54e609" },
            body: JSON.stringify({
                sessionId: "54e609",
                runId: "post-fix",
                hypothesisId: "H2",
                location: "EventsEditor.tsx:init",
                message: "EventsEditor form hydrated from events",
                data: {
                    slug,
                    formType: hydrated.type,
                    formEventAt: hydrated.eventAt,
                    tableExamDate: events.find((e) => e.type === "EXAM_DATE")?.eventAt ?? null,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion
    }, [events, slug]);
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const payload = {
                type: f.type,
                eventAt: new Date(f.eventAt).toISOString(),
                source: f.source,
                sourceUrl: f.sourceUrl,
                verifiedBy: f.verifiedBy,
                verifiedAt: new Date(f.verifiedAt).toISOString(),
            };
            const { data } = await apiClient.post<{ events: AdminExamEvent[] }>(`/admin/content/exams/${encodeURIComponent(slug)}/events`, payload);
            // #region agent log
            fetch("http://127.0.0.1:7497/ingest/21f8ef43-7e17-46b1-8c00-47111ca62dd3", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "54e609" },
                body: JSON.stringify({
                    sessionId: "54e609",
                    runId: "pre-fix",
                    hypothesisId: "H3",
                    location: "EventsEditor.tsx:submit",
                    message: "Admin event POST response",
                    data: {
                        slug,
                        payload,
                        responseEventCount: data?.events?.length ?? null,
                        responseEvents: (data?.events ?? []).map((e) => ({
                            type: e.type,
                            eventAt: e.eventAt,
                            verifiedBy: e.verifiedBy,
                        })),
                    },
                    timestamp: Date.now(),
                }),
            }).catch(() => {});
            // #endregion
            onChange(data.events);
            await Swal.fire({ icon: "success", title: "Etkinlik kaydedildi", timer: 1000, showConfirmButton: false });
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Kaydedilemedi.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (type: string) => {
        const confirm = await Swal.fire({
            title: "Etkinlik silinsin mi?",
            text: type,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sil",
            cancelButtonText: "Vazgeç",
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            // DELETE is 204 (no body); refetch the exam detail for the fresh events list.
            await apiClient.delete(`/admin/content/exams/${encodeURIComponent(slug)}/events/${encodeURIComponent(type)}`);
            const { data } = await apiClient.get<AdminExamDetail>(`/admin/content/exams/${encodeURIComponent(slug)}`);
            onChange(data.events);
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Silinemedi.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally {
            setBusy(false);
        }
    };

    // Prefill the form when picking a type that already exists (edit-in-place).
    const onPickType = (e: { target: { value: string } }) => {
        const type = e.target.value;
        const existing = events.find((x) => x.type === type);
        setF((p) => ({
            ...p,
            type,
            eventAt: toLocalInput(existing?.eventAt),
            source: existing?.source ?? p.source,
            sourceUrl: existing?.sourceUrl ?? p.sourceUrl,
            verifiedBy: existing?.verifiedBy ?? p.verifiedBy,
            verifiedAt: toLocalInput(existing?.verifiedAt),
        }));
    };

    return (
        <div className="card stretch stretch-full mt-3">
            <div className="card-header"><h5 className="card-title">Takvim etkinlikleri</h5></div>
            <div className="card-body">
                <div className="table-responsive mb-3">
                    <table className="table table-hover mb-0">
                        <thead>
                            <tr><th>Tür</th><th>Tarih</th><th>Kaynak</th><th>Doğrulayan</th><th className="text-end">İşlem</th></tr>
                        </thead>
                        <tbody>
                            {events.length === 0 && <tr><td colSpan={5} className="text-center py-3 text-muted">Etkinlik yok.</td></tr>}
                            {events.map((ev) => (
                                <tr key={ev.id}>
                                    <td className="fs-12">{ev.type}</td>
                                    <td>{new Date(ev.eventAt).toLocaleString("tr-TR")}</td>
                                    <td className="fs-12"><a href={ev.sourceUrl} target="_blank" rel="noreferrer">{ev.source}</a></td>
                                    <td className="fs-12 text-muted">{ev.verifiedBy}</td>
                                    <td className="text-end">
                                        <button className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => remove(ev.type)}>Sil</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <form onSubmit={submit} className="row g-3">
                    <div className="col-12"><span className="fs-12 text-muted">Etkinlik ekle / güncelle (tür başına bir kayıt)</span></div>
                    <div className="col-md-4">
                        <label className="form-label">Tür</label>
                        <select className="form-select" value={f.type} onChange={onPickType}>
                            {EVENT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Tarih</label>
                        <input className="form-control" type="datetime-local" value={f.eventAt} onChange={set("eventAt")} required />
                    </div>
                    <div className="col-12"><hr className="my-1" /><span className="fs-12 text-muted">Güven bilgisi (§4 — zorunlu)</span></div>
                    <div className="col-md-4">
                        <label className="form-label">Kaynak</label>
                        <input className="form-control" value={f.source} onChange={set("source")} required placeholder="ÖSYM" />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Kaynak URL</label>
                        <input className="form-control" type="url" value={f.sourceUrl} onChange={set("sourceUrl")} required placeholder="https://osym.gov.tr/..." />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Doğrulayan</label>
                        <input className="form-control" value={f.verifiedBy} onChange={set("verifiedBy")} required />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Doğrulama tarihi</label>
                        <input className="form-control" type="datetime-local" value={f.verifiedAt} onChange={set("verifiedAt")} required />
                    </div>
                    <div className="col-12">
                        <button type="submit" className="btn btn-primary" disabled={busy}>Etkinliği kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

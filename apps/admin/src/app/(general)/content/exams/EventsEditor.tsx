'use client'
import { useEffect, useState, type FormEvent } from "react";
import { FiExternalLink, FiTrash2 } from "react-icons/fi";
import Swal from "sweetalert2";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { FieldLabel } from "@/components/shared/admin/FieldLabel";
import { FormSection } from "@/components/shared/admin/FormSection";
import { IconAction } from "@/components/shared/admin/IconAction";
import apiClient from "@/lib/apiClient";
import type { AdminExamDetail, AdminExamEvent } from "@/lib/types";

const EVENT_TYPES = ["EXAM_DATE", "APPLICATION_START", "APPLICATION_END", "RESULT_DATE"];

const EVENT_TYPE_LABELS: Record<string, string> = {
    EXAM_DATE: "Sınav tarihi",
    APPLICATION_START: "Başvuru başlangıcı",
    APPLICATION_END: "Başvuru bitişi",
    RESULT_DATE: "Sonuç tarihi",
};

const eventTypeLabel = (type: string) => EVENT_TYPE_LABELS[type] ?? type;

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
        setF((p) => formFromEvents(events, p.type));
    }, [events]);
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
            text: eventTypeLabel(type),
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
        <>
            <DataTableShell
                toolbar={
                    <div className="admin-table-toolbar-content">
                        <h2 className="card-title mb-0">Takvim etkinlikleri</h2>
                        <span className="text-muted fs-12">{events.length} etkinlik</span>
                    </div>
                }
                state={events.length === 0 ? <AsyncState status="empty" size="compact" title="Henüz takvim etkinliği yok" description="Aşağıdaki formdan ilk resmi tarihi ekleyebilirsin." /> : undefined}
            >
                {events.length > 0 ? (
                    <table className="table table-hover align-middle mb-0 admin-data-table exam-events-table">
                        <thead><tr><th>Etkinlik</th><th>Tarih</th><th>Resmi kaynak</th><th>Doğrulama</th><th><span className="visually-hidden">İşlemler</span></th></tr></thead>
                        <tbody>
                            {events.map((event) => (
                                <tr key={event.id}>
                                    <td className="admin-table-primary">{eventTypeLabel(event.type)}<span>{event.type}</span></td>
                                    <td className="text-nowrap">{new Date(event.eventAt).toLocaleString("tr-TR")}</td>
                                    <td><a href={event.sourceUrl} target="_blank" rel="noreferrer" className="d-inline-flex align-items-center gap-1">{event.source}<FiExternalLink aria-hidden="true" /></a></td>
                                    <td><strong>{event.verifiedBy}</strong><span className="admin-table-secondary">{new Date(event.verifiedAt).toLocaleString("tr-TR")}</span></td>
                                    <td className="text-end"><IconAction label={`${eventTypeLabel(event.type)} etkinliğini sil`} icon={<FiTrash2 />} tone="danger" busy={busy} onClick={() => void remove(event.type)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : null}
            </DataTableShell>

            <div className="mt-4">
                <FormSection title="Etkinlik ekle veya güncelle" hint="Her etkinlik türü için tek kayıt tutulur. Var olan bir türü seçmek formu o kayıtla doldurur.">
                    <div className="alert alert-info py-2" role="note">
                        Resmi tarih yalnız doğrulanmış kaynağa dayanır. Kaynak ve doğrulayan bilgisi zorunludur.
                    </div>
                    <form onSubmit={submit} className="row g-4" aria-busy={busy}>
                        <div className="col-md-6">
                            <FieldLabel htmlFor="event-type" label="Etkinlik türü" required />
                            <select id="event-type" className="form-select" value={f.type} onChange={onPickType}>
                                {EVENT_TYPES.map((type) => <option key={type} value={type}>{eventTypeLabel(type)}</option>)}
                            </select>
                        </div>
                        <div className="col-md-6">
                            <FieldLabel htmlFor="event-date" label="Etkinlik tarihi" required />
                            <input id="event-date" className="form-control" type="datetime-local" value={f.eventAt} onChange={set("eventAt")} required />
                        </div>
                        <div className="col-md-6">
                            <FieldLabel htmlFor="event-source" label="Resmi kaynak" required />
                            <input id="event-source" className="form-control" value={f.source} onChange={set("source")} required placeholder="ÖSYM" />
                        </div>
                        <div className="col-md-6">
                            <FieldLabel htmlFor="event-source-url" label="Kaynak bağlantısı" required hint="Doğrudan resmi kurumun duyuru veya takvim sayfasına yönlendirmelidir." />
                            <input id="event-source-url" className="form-control" type="url" value={f.sourceUrl} onChange={set("sourceUrl")} required placeholder="https://osym.gov.tr/..." />
                        </div>
                        <div className="col-md-6">
                            <FieldLabel htmlFor="event-verifier" label="Doğrulayan" required />
                            <input id="event-verifier" className="form-control" value={f.verifiedBy} onChange={set("verifiedBy")} required />
                        </div>
                        <div className="col-md-6">
                            <FieldLabel htmlFor="event-verified-at" label="Doğrulama tarihi" required />
                            <input id="event-verified-at" className="form-control" type="datetime-local" value={f.verifiedAt} onChange={set("verifiedAt")} required />
                        </div>
                        <div className="col-12">
                            <button type="submit" className="btn btn-primary admin-submit-button" disabled={busy}>
                                {busy ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : null}
                                <span>{busy ? "Kaydediliyor…" : "Etkinliği kaydet"}</span>
                            </button>
                        </div>
                    </form>
                </FormSection>
            </div>
        </>
    );
}

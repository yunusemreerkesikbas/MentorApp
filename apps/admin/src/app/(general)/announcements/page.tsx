'use client'
import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminAnnouncement, AnnouncementAudience } from "@/lib/types";

// Team-authored broadcast (W5). Creates a DRAFT, then sends it — the API queues the fan-out into
// every recipient's in-app inbox. In-app only: no push, no e-mail. Every mutation is audited
// server-side, so there is deliberately no client-side audit here.

const AUDIENCE_OPTIONS = [
    { value: "ALL", label: "Tüm kullanıcılar" },
    { value: "KPSS", label: "Sadece KPSS" },
    { value: "YKS", label: "Sadece YKS" },
    { value: "LGS", label: "Sadece LGS" },
] as const;

/** Companion-register starters — sen, no guilt. Student-facing; see docs/copy/voice.md. */
const VOICE_EXAMPLES = [
    {
        label: "Yeni özellik",
        title: "Yeni bir ritim başladı",
        body: "Çalışma odaları açıldı. İstersen bir masaya otur — yalnız çalışmak zorunda değilsin.",
    },
    {
        label: "Bakım",
        title: "Kısa bir bakım",
        body: "Bu gece kısa bir bakım olacak. Yarın yine buradayız.",
    },
    {
        label: "Hatırlatma",
        title: "Haftanın küçük notu",
        body: "Bu hafta defterine dönmek için güzel bir gün. Beş dakika yeter.",
    },
] as const;

type AudienceValue = (typeof AUDIENCE_OPTIONS)[number]["value"];

function toAudience(value: AudienceValue): AnnouncementAudience {
    return value === "ALL" ? { kind: "ALL" } : { kind: "EXAM_TYPE", examType: value };
}

function audienceLabel(audience: AnnouncementAudience): string {
    return audience.kind === "ALL" ? "Tüm kullanıcılar" : `Sadece ${audience.examType}`;
}

const STATUS_BADGE: Record<AdminAnnouncement["status"], { className: string; label: string }> = {
    DRAFT: { className: "bg-soft-secondary text-secondary", label: "Taslak" },
    SENDING: { className: "bg-soft-warning text-warning", label: "Gönderiliyor" },
    SENT: { className: "bg-soft-success text-success", label: "Gönderildi" },
};

function formatDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString("tr-TR") : "—";
}

function errorMessage(err: unknown): string {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "İşlem tamamlanamadı."
    );
}

export default function AnnouncementsPage() {
    const [items, setItems] = useState<AdminAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const [audience, setAudience] = useState<AudienceValue>("ALL");
    const [scheduledAt, setScheduledAt] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<AdminAnnouncement[]>("/admin/announcements");
            setItems(data);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const createDraft = async () => {
        setCreating(true);
        try {
            const { data } = await apiClient.post<AdminAnnouncement>("/admin/announcements", {
                title: title.trim(),
                body: body.trim(),
                ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
                audience: toAudience(audience),
            });
            setItems((current) => [data, ...current]);
            setTitle("");
            setBody("");
            setLinkUrl("");
            Swal.fire({ icon: "success", title: "Taslak oluşturuldu", timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errorMessage(err) });
        } finally {
            setCreating(false);
        }
    };

    // Sending is irreversible and reaches every matching user — always confirm, and spell out the
    // audience so nobody broadcasts to everyone by accident.
    const send = async (item: AdminAnnouncement) => {
        const when = scheduledAt
            ? ` Zamanlama: ${new Date(scheduledAt).toLocaleString("tr-TR")}.`
            : "";
        const confirmed = await Swal.fire({
            title: "Duyuru gönderilsin mi?",
            text: `"${item.title}" → ${audienceLabel(item.audience)}. Bu işlem geri alınamaz.${when}`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Gönder",
            cancelButtonText: "Vazgeç",
        });
        if (!confirmed.isConfirmed) return;

        setBusyId(item.id);
        try {
            const { data } = await apiClient.post<AdminAnnouncement>(
                `/admin/announcements/${item.id}/send`,
                scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {},
            );
            setItems((current) => current.map((row) => (row.id === data.id ? data : row)));
            setScheduledAt("");
            Swal.fire({ icon: "success", title: "Kuyruğa alındı", timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errorMessage(err) });
            await load();
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (item: AdminAnnouncement) => {
        const confirmed = await Swal.fire({
            title: "Taslak silinsin mi?",
            text: item.title,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sil",
            cancelButtonText: "Vazgeç",
        });
        if (!confirmed.isConfirmed) return;

        setBusyId(item.id);
        try {
            await apiClient.delete(`/admin/announcements/${item.id}`);
            setItems((current) => current.filter((row) => row.id !== item.id));
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errorMessage(err) });
        } finally {
            setBusyId(null);
        }
    };

    const canCreate = title.trim().length > 0 && body.trim().length > 0 && !creating;

    return (
        <>
            <PageHeader>{null}</PageHeader>
            <div className="main-content">
                <div className="card stretch stretch-full mb-4">
                    <div className="card-header">
                        <h5 className="mb-0">Yeni duyuru</h5>
                        <p className="mb-0 fs-12 text-muted">
                            Uygulama içi bildirim olarak iletilir (push/e-posta gönderilmez). Önce taslak
                            oluşturun, sonra listeden gönderin. Öğrenciye <strong>sen</strong> diye hitap
                            et; suçlama, FOMO ve &quot;kaçırdın&quot; yok. Resmi duyurularda sakin yoldaş
                            kaydı — şaka yok.
                        </p>
                    </div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-8">
                                <label className="form-label">Başlık</label>
                                <input
                                    className="form-control"
                                    maxLength={120}
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                />
                                <div className="fs-12 text-muted">{title.length}/120</div>
                                <div className="d-flex flex-wrap gap-2 mt-2">
                                    {VOICE_EXAMPLES.map((example) => (
                                        <button
                                            key={example.label}
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => {
                                                setTitle(example.title);
                                                setBody(example.body);
                                            }}
                                        >
                                            Örnek: {example.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Hedef kitle</label>
                                <select
                                    className="form-select"
                                    value={audience}
                                    onChange={(event) => setAudience(event.target.value as AudienceValue)}
                                >
                                    {AUDIENCE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-12">
                                <label className="form-label">Metin</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    maxLength={500}
                                    value={body}
                                    onChange={(event) => setBody(event.target.value)}
                                />
                                <div className="fs-12 text-muted">{body.length}/500</div>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">Bağlantı (opsiyonel)</label>
                                <input
                                    className="form-control"
                                    placeholder="/panel"
                                    value={linkUrl}
                                    onChange={(event) => setLinkUrl(event.target.value)}
                                />
                                <div className="fs-12 text-muted">
                                    Yalnızca uygulama içi yol (&quot;/&quot; ile başlamalı). Dış adres kabul
                                    edilmez.
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">Zamanlama (opsiyonel)</label>
                                <input
                                    className="form-control"
                                    type="datetime-local"
                                    value={scheduledAt}
                                    onChange={(event) => setScheduledAt(event.target.value)}
                                />
                                <div className="fs-12 text-muted">
                                    Boş bırakılırsa gönderim anında kuyruğa alınır.
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="card-footer text-end">
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!canCreate}
                            onClick={() => void createDraft()}
                        >
                            Taslak oluştur
                        </button>
                    </div>
                </div>

                <div className="card stretch stretch-full">
                    <div className="card-header">
                        <h5 className="mb-0">Duyurular</h5>
                    </div>
                    <div className="card-body p-0">
                        {loading && <div className="text-center py-5">Yükleniyor…</div>}
                        {!loading && items.length === 0 && (
                            <div className="text-center py-5 text-muted">Henüz duyuru yok.</div>
                        )}
                        {!loading && items.length > 0 && (
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th>Duyuru</th>
                                            <th>Hedef</th>
                                            <th>Durum</th>
                                            <th>Alıcı</th>
                                            <th>Gönderim</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <div className="fw-semibold">{item.title}</div>
                                                    <div className="fs-12 text-muted">{item.body}</div>
                                                    {item.linkUrl && (
                                                        <div className="fs-12 font-monospace text-muted">
                                                            {item.linkUrl}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>{audienceLabel(item.audience)}</td>
                                                <td>
                                                    <span
                                                        className={`badge ${STATUS_BADGE[item.status].className}`}
                                                    >
                                                        {STATUS_BADGE[item.status].label}
                                                    </span>
                                                </td>
                                                <td>{item.recipientCount}</td>
                                                <td className="fs-12">
                                                    {item.sentAt
                                                        ? formatDate(item.sentAt)
                                                        : item.scheduledAt
                                                          ? `Planlandı: ${formatDate(item.scheduledAt)}`
                                                          : "—"}
                                                </td>
                                                <td className="text-end">
                                                    {item.status === "DRAFT" && (
                                                        <div className="d-inline-flex gap-2">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-primary"
                                                                disabled={busyId === item.id}
                                                                onClick={() => void send(item)}
                                                            >
                                                                Gönder
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger"
                                                                disabled={busyId === item.id}
                                                                onClick={() => void remove(item)}
                                                            >
                                                                Sil
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

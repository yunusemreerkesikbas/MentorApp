'use client'

import { useCallback, useEffect, useState } from "react";
import { FiSend, FiTrash2 } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { FieldLabel } from "@/components/shared/admin/FieldLabel";
import { FormSection } from "@/components/shared/admin/FormSection";
import { IconAction } from "@/components/shared/admin/IconAction";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { AdminAnnouncement, AnnouncementAudience } from "@/lib/types";

const AUDIENCE_OPTIONS = [{ value: "ALL", label: "Tüm kullanıcılar" }, { value: "KPSS", label: "Sadece KPSS" }, { value: "YKS", label: "Sadece YKS" }, { value: "LGS", label: "Sadece LGS" }] as const;
const VOICE_EXAMPLES = [
    { label: "Yeni özellik", title: "Yeni bir ritim başladı", body: "Çalışma odaları açıldı. İstersen bir masaya otur, yalnız çalışmak zorunda değilsin." },
    { label: "Bakım", title: "Kısa bir bakım", body: "Bu gece kısa bir bakım olacak. Yarın yine buradayız." },
    { label: "Hatırlatma", title: "Haftanın küçük notu", body: "Bu hafta defterine dönmek için güzel bir gün. Beş dakika yeter." },
] as const;
type AudienceValue = (typeof AUDIENCE_OPTIONS)[number]["value"];

function toAudience(value: AudienceValue): AnnouncementAudience { return value === "ALL" ? { kind: "ALL" } : { kind: "EXAM_TYPE", examType: value }; }
function audienceLabel(audience: AnnouncementAudience) { return audience.kind === "ALL" ? "Tüm kullanıcılar" : `Sadece ${audience.examType}`; }
function formatDate(iso: string | null) { return iso ? new Date(iso).toLocaleString("tr-TR") : "—"; }
function errorMessage(error: unknown) { return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "İşlem tamamlanamadı."; }
function statusMeta(status: AdminAnnouncement["status"]) { return status === "SENT" ? { tone: "success" as const, label: "Gönderildi" } : status === "SENDING" ? { tone: "warning" as const, label: "Gönderiliyor" } : { tone: "neutral" as const, label: "Taslak" }; }

export default function AnnouncementsPage() {
    const [items, setItems] = useState<AdminAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const [audience, setAudience] = useState<AudienceValue>("ALL");
    const [scheduledAt, setScheduledAt] = useState("");

    const load = useCallback(async () => { setLoading(true); setError(false); try { const { data } = await apiClient.get<AdminAnnouncement[]>("/admin/announcements"); setItems(data); } catch { setItems([]); setError(true); } finally { setLoading(false); } }, []);
    useEffect(() => { void load(); }, [load]);

    const createDraft = async () => {
        setCreating(true);
        try { const { data } = await apiClient.post<AdminAnnouncement>("/admin/announcements", { title: title.trim(), body: body.trim(), ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}), audience: toAudience(audience) }); setItems((current) => [data, ...current]); setTitle(""); setBody(""); setLinkUrl(""); await Swal.fire({ icon: "success", title: "Taslak oluşturuldu", timer: 1200, showConfirmButton: false }); }
        catch (requestError) { await Swal.fire({ icon: "error", title: "Hata", text: errorMessage(requestError) }); }
        finally { setCreating(false); }
    };

    const send = async (item: AdminAnnouncement) => {
        const when = scheduledAt ? ` Zamanlama: ${new Date(scheduledAt).toLocaleString("tr-TR")}.` : "";
        const confirmed = await Swal.fire({ title: "Duyuru gönderilsin mi?", text: `“${item.title}” → ${audienceLabel(item.audience)}. Bu işlem geri alınamaz.${when}`, icon: "warning", showCancelButton: true, confirmButtonText: "Gönder", cancelButtonText: "Vazgeç" });
        if (!confirmed.isConfirmed) return;
        setBusyId(item.id);
        try { const { data } = await apiClient.post<AdminAnnouncement>(`/admin/announcements/${item.id}/send`, scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}); setItems((current) => current.map((row) => row.id === data.id ? data : row)); setScheduledAt(""); await Swal.fire({ icon: "success", title: "Kuyruğa alındı", timer: 1200, showConfirmButton: false }); }
        catch (requestError) { await Swal.fire({ icon: "error", title: "Hata", text: errorMessage(requestError) }); await load(); }
        finally { setBusyId(null); }
    };

    const remove = async (item: AdminAnnouncement) => {
        const confirmed = await Swal.fire({ title: "Taslak silinsin mi?", text: item.title, icon: "warning", showCancelButton: true, confirmButtonText: "Sil", cancelButtonText: "Vazgeç" });
        if (!confirmed.isConfirmed) return;
        setBusyId(item.id);
        try { await apiClient.delete(`/admin/announcements/${item.id}`); setItems((current) => current.filter((row) => row.id !== item.id)); }
        catch (requestError) { await Swal.fire({ icon: "error", title: "Hata", text: errorMessage(requestError) }); }
        finally { setBusyId(null); }
    };

    const canCreate = title.trim().length > 0 && body.trim().length > 0 && !creating;
    const state = loading ? <AsyncState status="loading" title="Duyurular yükleniyor" /> : error ? <AsyncState status="error" title="Duyurular yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyin." onRetry={() => void load()} /> : items.length === 0 ? <AsyncState status="empty" title="Henüz duyuru yok" description="Yukarıdaki formdan ilk taslağı oluşturabilirsiniz." /> : undefined;

    return <>
        <AdminPageHeader title="Duyurular" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Duyurular" }]} />
        <div className="main-content">
            <FormSection title="Yeni duyuru" hint="Öğrenciye sen diye hitap edin; suçlama, baskı ve kaçırma korkusu oluşturan ifadelerden kaçının." footer={<div className="text-end"><button type="button" className="btn btn-primary admin-submit-button" disabled={!canCreate} aria-busy={creating || undefined} onClick={() => void createDraft()}>{creating ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Oluşturuluyor…</> : "Taslak oluştur"}</button></div>}>
                <div className="alert alert-info" role="note">Yalnız uygulama içi bildirim oluşturulur. Push veya e-posta gönderilmez; taslak ayrıca listeden gönderilmelidir.</div>
                <div className="row g-3"><div className="col-md-8"><FieldLabel htmlFor="announcement-title" label="Başlık" required /><input id="announcement-title" className="form-control" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /><div className="fs-12 text-muted text-end">{title.length}/120</div><div className="d-flex flex-wrap gap-2 mt-2">{VOICE_EXAMPLES.map((example) => <button key={example.label} type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setTitle(example.title); setBody(example.body); }}>Örnek: {example.label}</button>)}</div></div><div className="col-md-4"><FieldLabel htmlFor="announcement-audience" label="Hedef kitle" required /><select id="announcement-audience" className="form-select" value={audience} onChange={(event) => setAudience(event.target.value as AudienceValue)}>{AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="col-12"><FieldLabel htmlFor="announcement-body" label="Metin" required /><textarea id="announcement-body" className="form-control" rows={3} maxLength={500} value={body} onChange={(event) => setBody(event.target.value)} /><div className="fs-12 text-muted text-end">{body.length}/500</div></div><div className="col-md-6"><FieldLabel htmlFor="announcement-link" label="Bağlantı" hint="Opsiyoneldir ve / ile başlayan uygulama içi bir yol olmalıdır. Dış adres kabul edilmez." /><input id="announcement-link" className="form-control" placeholder="/panel" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} /></div><div className="col-md-6"><FieldLabel htmlFor="announcement-schedule" label="Gönderim zamanı" hint="Bu zaman, aşağıdaki taslaklardan herhangi birini gönderirken uygulanır. Boşsa gönderim hemen kuyruğa alınır." /><input id="announcement-schedule" className="form-control" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></div></div>
            </FormSection>
            <DataTableShell state={state} toolbar={<div><h2 className="h6 mb-1">Duyuru geçmişi</h2><span className="text-muted fs-12">{items.length} kayıt</span></div>}><table className="table align-middle mb-0 announcements-table"><thead><tr><th>Duyuru</th><th>Hedef</th><th>Durum</th><th>Alıcı</th><th>Gönderim</th><th className="text-end">İşlemler</th></tr></thead><tbody>{items.map((item) => { const meta = statusMeta(item.status); return <tr key={item.id}><td><div className="admin-table-primary">{item.title}<span>{item.body}</span></div>{item.linkUrl ? <span className="admin-table-secondary font-monospace">{item.linkUrl}</span> : null}</td><td>{audienceLabel(item.audience)}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td>{item.recipientCount}</td><td>{item.sentAt ? formatDate(item.sentAt) : item.scheduledAt ? `Planlandı: ${formatDate(item.scheduledAt)}` : "—"}</td><td className="text-end">{item.status === "DRAFT" ? <div className="d-inline-flex gap-2"><IconAction label="Duyuruyu gönder" icon={<FiSend aria-hidden="true" />} tone="success" busy={busyId === item.id} onClick={() => void send(item)} /><IconAction label="Taslağı sil" icon={<FiTrash2 aria-hidden="true" />} tone="danger" busy={busyId === item.id} onClick={() => void remove(item)} /></div> : <span className="text-muted">—</span>}</td></tr>; })}</tbody></table></DataTableShell>
        </div>
    </>;
}

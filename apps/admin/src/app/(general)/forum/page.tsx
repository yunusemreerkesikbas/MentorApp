'use client';

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import type { ForumTagView, Paginated, ZoneView } from "@mentor/types";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import { JOIN_POLICY_LABELS, ZONE_TYPE_LABELS } from "./ZoneForm";

interface FeaturedThreadAdminView {
    threadId: string;
    featuredUntil: string | null;
    featuredBy: string | null;
}

interface TagDraft {
    slug: string;
    nameTr: string;
    nameEn: string;
    examType: string;
    isActive: boolean;
}

const EMPTY_TAG: TagDraft = {
    slug: "",
    nameTr: "",
    nameEn: "",
    examType: "",
    isActive: true,
};

export default function ForumManagementPage() {
    const [zones, setZones] = useState<ZoneView[]>([]);
    const [tags, setTags] = useState<ForumTagView[]>([]);
    const [featured, setFeatured] = useState<FeaturedThreadAdminView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        const [zoneResult, tagResult, featuredResult] = await Promise.allSettled([
            apiClient.get<Paginated<ZoneView>>("/forum/zones?pageSize=100"),
            apiClient.get<ForumTagView[]>("/admin/forum/tags"),
            apiClient.get<FeaturedThreadAdminView | null>("/admin/forum/featured-thread"),
        ]);
        if (zoneResult.status === "fulfilled") setZones(zoneResult.value.data.items);
        if (tagResult.status === "fulfilled") setTags(tagResult.value.data);
        if (featuredResult.status === "fulfilled") setFeatured(featuredResult.value.data);
        setError(
            zoneResult.status === "rejected" ||
            tagResult.status === "rejected" ||
            featuredResult.status === "rejected",
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <>
            <PageHeader>
                <Link href="/forum/new" className="btn btn-primary btn-sm">
                    + Yeni oda
                </Link>
            </PageHeader>
            <div className="main-content">
                {loading && <div className="text-center py-5">Yükleniyor…</div>}
                {!loading && error && (
                    <div className="alert alert-warning d-flex align-items-center justify-content-between">
                        <span>Bazı topluluk verileri yüklenemedi.</span>
                        <button className="btn btn-sm btn-outline-dark" onClick={() => void load()}>
                            Yeniden dene
                        </button>
                    </div>
                )}
                {!loading && (
                    <>
                        <FeaturedEditor value={featured} onChanged={load} />
                        <TagManager tags={tags} onChanged={load} />
                        <ZoneTable zones={zones} />
                    </>
                )}
            </div>
        </>
    );
}

function FeaturedEditor({
    value,
    onChanged,
}: {
    value: FeaturedThreadAdminView | null;
    onChanged: () => Promise<void>;
}) {
    const [threadId, setThreadId] = useState(value?.threadId ?? "");
    const [featuredUntil, setFeaturedUntil] = useState(
        value?.featuredUntil ? toLocalDateTime(value.featuredUntil) : defaultFeaturedDate(),
    );
    const [busy, setBusy] = useState(false);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try {
            await apiClient.put("/admin/forum/featured-thread", {
                threadId: threadId.trim(),
                featuredUntil: new Date(featuredUntil).toISOString(),
            });
            await Swal.fire({
                icon: "success",
                title: "Öne çıkan tartışma kaydedildi",
                timer: 1100,
                showConfirmButton: false,
            });
            await onChanged();
        } catch (error) {
            await showApiError(error, "Tartışma öne çıkarılamadı.");
        } finally {
            setBusy(false);
        }
    };

    const clear = async () => {
        const confirmation = await Swal.fire({
            title: "Seçimi kaldır",
            text: "Hub, trend skoruna göre otomatik bir tartışma seçecek.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Kaldır",
            cancelButtonText: "Vazgeç",
        });
        if (!confirmation.isConfirmed) return;
        setBusy(true);
        try {
            await apiClient.delete("/admin/forum/featured-thread");
            setThreadId("");
            setFeaturedUntil(defaultFeaturedDate());
            await onChanged();
        } catch (error) {
            await showApiError(error, "Seçim kaldırılamadı.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="card stretch stretch-full mb-4">
            <div className="card-header">
                <div>
                    <h5 className="mb-1">Öne çıkan tartışma</h5>
                    <p className="mb-0 fs-12 text-muted">
                        Manuel seçim yoksa sistem son yedi gündeki etkileşimlerden güvenli bir fallback seçer.
                    </p>
                </div>
                {value && <span className="badge bg-soft-success text-success">Aktif</span>}
            </div>
            <form className="card-body" onSubmit={save}>
                <div className="row g-3 align-items-end">
                    <div className="col-lg-7">
                        <label className="form-label" htmlFor="featured-thread-id">
                            Thread ID
                        </label>
                        <input
                            id="featured-thread-id"
                            className="form-control"
                            value={threadId}
                            onChange={(event) => setThreadId(event.target.value)}
                            placeholder="UUID"
                            required
                        />
                    </div>
                    <div className="col-lg-3">
                        <label className="form-label" htmlFor="featured-until">
                            Bitiş
                        </label>
                        <input
                            id="featured-until"
                            type="datetime-local"
                            className="form-control"
                            value={featuredUntil}
                            min={toLocalDateTime(new Date().toISOString())}
                            onChange={(event) => setFeaturedUntil(event.target.value)}
                            required
                        />
                    </div>
                    <div className="col-lg-2 d-grid gap-2">
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                    </div>
                </div>
                {value && (
                    <div className="mt-3 d-flex flex-wrap align-items-center gap-3">
                        <span className="fs-12 text-muted">
                            Bitiş: {value.featuredUntil ? new Date(value.featuredUntil).toLocaleString("tr-TR") : "—"}
                        </span>
                        <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => void clear()}>
                            Manuel seçimi kaldır
                        </button>
                    </div>
                )}
            </form>
        </section>
    );
}

function TagManager({
    tags,
    onChanged,
}: {
    tags: ForumTagView[];
    onChanged: () => Promise<void>;
}) {
    const [draft, setDraft] = useState<TagDraft>(EMPTY_TAG);
    const [busyId, setBusyId] = useState<string | null>(null);

    const create = async (event: FormEvent) => {
        event.preventDefault();
        setBusyId("new");
        try {
            await apiClient.post("/admin/forum/tags", {
                slug: draft.slug.trim().toLowerCase(),
                nameTr: draft.nameTr.trim(),
                nameEn: draft.nameEn.trim(),
                examType: draft.examType.trim() || null,
                isActive: draft.isActive,
            });
            setDraft(EMPTY_TAG);
            await onChanged();
        } catch (error) {
            await showApiError(error, "Etiket oluşturulamadı.");
        } finally {
            setBusyId(null);
        }
    };

    const update = async (tag: ForumTagView, patch: Partial<TagDraft>) => {
        setBusyId(tag.id);
        try {
            await apiClient.patch(`/admin/forum/tags/${tag.id}`, patch);
            await onChanged();
        } catch (error) {
            await showApiError(error, "Etiket güncellenemedi.");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className="card stretch stretch-full mb-4">
            <div className="card-header">
                <div>
                    <h5 className="mb-1">Kürasyonlu etiketler</h5>
                    <p className="mb-0 fs-12 text-muted">
                        Kullanıcılar serbest etiket yazamaz; aktif listedeki en fazla üç etiketi seçer.
                    </p>
                </div>
            </div>
            <div className="card-body border-bottom">
                <form className="row g-2 align-items-end" onSubmit={create}>
                    <div className="col-md-2">
                        <label className="form-label">Slug</label>
                        <input
                            className="form-control"
                            value={draft.slug}
                            onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                            placeholder="motivasyon"
                            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                            maxLength={80}
                            required
                        />
                    </div>
                    <div className="col-md-2">
                        <label className="form-label">Türkçe ad</label>
                        <input
                            className="form-control"
                            value={draft.nameTr}
                            onChange={(event) => setDraft((current) => ({ ...current, nameTr: event.target.value }))}
                            maxLength={80}
                            required
                        />
                    </div>
                    <div className="col-md-2">
                        <label className="form-label">İngilizce ad</label>
                        <input
                            className="form-control"
                            value={draft.nameEn}
                            onChange={(event) => setDraft((current) => ({ ...current, nameEn: event.target.value }))}
                            maxLength={80}
                            required
                        />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Sınav tipi (opsiyonel)</label>
                        <input
                            className="form-control"
                            value={draft.examType}
                            onChange={(event) => setDraft((current) => ({ ...current, examType: event.target.value }))}
                            placeholder="KPSS"
                            maxLength={32}
                        />
                    </div>
                    <div className="col-md-2">
                        <div className="form-check form-switch mb-2">
                            <input
                                id="new-tag-active"
                                type="checkbox"
                                className="form-check-input"
                                checked={draft.isActive}
                                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
                            />
                            <label className="form-check-label" htmlFor="new-tag-active">Aktif</label>
                        </div>
                    </div>
                    <div className="col-md-1 d-grid">
                        <button className="btn btn-primary" disabled={busyId === "new"}>Ekle</button>
                    </div>
                </form>
            </div>
            <div className="table-responsive">
                <table className="table align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Slug</th>
                            <th>Türkçe</th>
                            <th>İngilizce</th>
                            <th>Sınav</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tags.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-4 text-muted">Henüz etiket yok.</td></tr>
                        )}
                        {tags.map((tag) => (
                            <tr key={tag.id}>
                                <td><code className="fs-12">{tag.slug}</code></td>
                                <td>
                                    <InlineTagInput
                                        value={tag.nameTr ?? tag.name}
                                        disabled={busyId === tag.id}
                                        onSave={(nameTr) => update(tag, { nameTr })}
                                    />
                                </td>
                                <td>
                                    <InlineTagInput
                                        value={tag.nameEn ?? tag.name}
                                        disabled={busyId === tag.id}
                                        onSave={(nameEn) => update(tag, { nameEn })}
                                    />
                                </td>
                                <td>{tag.examType ?? <span className="text-muted">Genel</span>}</td>
                                <td>
                                    <div className="form-check form-switch">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={tag.isActive}
                                            disabled={busyId === tag.id}
                                            aria-label={`${tag.name} aktiflik durumu`}
                                            onChange={(event) => void update(tag, { isActive: event.target.checked })}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function InlineTagInput({
    value,
    disabled,
    onSave,
}: {
    value: string;
    disabled: boolean;
    onSave: (value: string) => Promise<void>;
}) {
    const [draft, setDraft] = useState(value);
    useEffect(() => {
        setDraft(value);
    }, [value]);

    return (
        <div className="input-group input-group-sm" style={{ minWidth: 180 }}>
            <input
                className="form-control"
                value={draft}
                disabled={disabled}
                maxLength={80}
                onChange={(event) => setDraft(event.target.value)}
            />
            <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={disabled || !draft.trim() || draft.trim() === value}
                onClick={() => void onSave(draft.trim())}
            >
                Kaydet
            </button>
        </div>
    );
}

function ZoneTable({ zones }: { zones: ZoneView[] }) {
    return (
        <section className="card stretch stretch-full">
            <div className="card-header">
                <div>
                    <h5 className="mb-1">Topluluk odaları</h5>
                    <p className="mb-0 fs-12 text-muted">Sohbet, duyuru ve soru-cevap alanları.</p>
                </div>
            </div>
            <div className="table-responsive">
                <table className="table table-hover mb-0">
                    <thead>
                        <tr>
                            <th>Tür</th>
                            <th>Başlık</th>
                            <th>Slug</th>
                            <th>Katılım</th>
                            <th>Sınav</th>
                            <th>Üye</th>
                            <th>Oluşturulma</th>
                        </tr>
                    </thead>
                    <tbody>
                        {zones.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-4 text-muted">
                                    Henüz oda yok. <Link href="/forum/new">İlkini oluştur →</Link>
                                </td>
                            </tr>
                        )}
                        {zones.map((zone) => (
                            <tr key={zone.id}>
                                <td>
                                    <span className="badge bg-soft-primary text-primary">
                                        {ZONE_TYPE_LABELS[zone.type] ?? zone.type}
                                    </span>
                                </td>
                                <td>{zone.title}</td>
                                <td><code className="fs-12">{zone.slug}</code></td>
                                <td>{JOIN_POLICY_LABELS[zone.joinPolicy] ?? zone.joinPolicy}</td>
                                <td>{zone.examType ?? <span className="text-muted">—</span>}</td>
                                <td>{zone.memberCount}</td>
                                <td>{new Date(zone.createdAt).toLocaleDateString("tr-TR")}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function defaultFeaturedDate(): string {
    return toLocalDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
}

function toLocalDateTime(value: string): string {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

async function showApiError(error: unknown, fallback: string): Promise<void> {
    const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        fallback;
    await Swal.fire({ icon: "error", title: "Hata", text: message });
}

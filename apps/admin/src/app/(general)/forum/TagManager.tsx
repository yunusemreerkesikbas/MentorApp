"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ForumCoachIntent, ForumTagView } from "@mentor/types";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import { COACH_INTENT_LABELS, showForumApiError } from "./forum-helpers";

interface TagDraft {
    slug: string;
    nameTr: string;
    nameEn: string;
    examType: string;
    isActive: boolean;
    coachIntent: ForumCoachIntent | null;
}

const EMPTY_TAG: TagDraft = {
    slug: "",
    nameTr: "",
    nameEn: "",
    examType: "",
    isActive: true,
    coachIntent: null,
};

export function TagManager({
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
                coachIntent: draft.coachIntent,
            });
            setDraft(EMPTY_TAG);
            await onChanged();
        } catch (error) {
            await showForumApiError(error, "Etiket oluşturulamadı.");
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
            await showForumApiError(error, "Etiket güncellenemedi.");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className="card stretch stretch-full">
            <div className="card-header">
                <div>
                    <h5 className="mb-1">Kürasyonlu etiketler</h5>
                    <p className="mb-0 fs-12 text-muted">
                        Kullanıcılar aktif listeden seçim yapar; bulamadıkları etiketleri inceleme için önerebilir.
                    </p>
                </div>
            </div>
            <div className="card-body border-bottom">
                <form className="row g-3 align-items-end" onSubmit={create}>
                    <div className="col-lg-2 col-md-4">
                        <label className="form-label" htmlFor="new-tag-slug">Slug</label>
                        <input
                            id="new-tag-slug"
                            className="form-control"
                            value={draft.slug}
                            onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                            placeholder="motivasyon"
                            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                            maxLength={80}
                            required
                        />
                    </div>
                    <div className="col-lg-2 col-md-4">
                        <label className="form-label" htmlFor="new-tag-tr">Türkçe ad</label>
                        <input
                            id="new-tag-tr"
                            className="form-control"
                            value={draft.nameTr}
                            onChange={(event) => setDraft((current) => ({ ...current, nameTr: event.target.value }))}
                            maxLength={80}
                            required
                        />
                    </div>
                    <div className="col-lg-2 col-md-4">
                        <label className="form-label" htmlFor="new-tag-en">İngilizce ad</label>
                        <input
                            id="new-tag-en"
                            className="form-control"
                            value={draft.nameEn}
                            onChange={(event) => setDraft((current) => ({ ...current, nameEn: event.target.value }))}
                            maxLength={80}
                            required
                        />
                    </div>
                    <div className="col-lg-2 col-md-4">
                        <label className="form-label" htmlFor="new-tag-exam">Sınav tipi</label>
                        <input
                            id="new-tag-exam"
                            className="form-control"
                            value={draft.examType}
                            onChange={(event) => setDraft((current) => ({ ...current, examType: event.target.value }))}
                            placeholder="KPSS"
                            maxLength={32}
                        />
                    </div>
                    <div className="col-lg-2 col-md-4">
                        <label className="form-label" htmlFor="new-tag-intent">Koç niyeti</label>
                        <select
                            id="new-tag-intent"
                            className="form-select"
                            value={draft.coachIntent ?? ""}
                            onChange={(event) => setDraft((current) => ({
                                ...current,
                                coachIntent: (event.target.value || null) as ForumCoachIntent | null,
                            }))}
                        >
                            <option value="">Köprü yok</option>
                            {Object.entries(COACH_INTENT_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-lg-2 col-md-4">
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
                        <button className="btn btn-primary w-100" disabled={busyId === "new"} type="submit">Ekle</button>
                    </div>
                </form>
            </div>
            <div className="card-body custom-card-action p-0">
                <div className="table-responsive">
                    <table className="table table-hover mb-0 forum-tags-table">
                        <thead>
                            <tr className="border-b">
                                <th>Etiket</th>
                                <th>Türkçe</th>
                                <th>İngilizce</th>
                                <th>Koç niyeti</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tags.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-muted">Henüz etiket yok.</td>
                                </tr>
                            ) : null}
                            {tags.map((tag) => (
                                <tr key={tag.id} className="chat-single-item">
                                    <td>
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="avatar-text user-avatar-text text-uppercase">
                                                {tag.slug.slice(0, 1)}
                                            </div>
                                            <div>
                                                <code className="fs-12 d-block">{tag.slug}</code>
                                                <span className="fs-12 text-muted">
                                                    {tag.examType ?? "Genel"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
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
                                    <td className="admin-forum-intent-cell">
                                        <select
                                            className="form-select form-select-sm"
                                            value={tag.coachIntent ?? ""}
                                            disabled={busyId === tag.id}
                                            aria-label={`${tag.name} koç niyeti`}
                                            onChange={(event) => void update(tag, {
                                                coachIntent: (event.target.value || null) as ForumCoachIntent | null,
                                            })}
                                        >
                                            <option value="">Köprü yok</option>
                                            {Object.entries(COACH_INTENT_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="form-check form-switch mb-0">
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={tag.isActive}
                                                    disabled={busyId === tag.id}
                                                    aria-label={`${tag.name} aktiflik durumu`}
                                                    onChange={(event) => void update(tag, { isActive: event.target.checked })}
                                                />
                                            </div>
                                            <StatusBadge tone={tag.isActive ? "success" : "neutral"}>
                                                {tag.isActive ? "Aktif" : "Pasif"}
                                            </StatusBadge>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
        <div className="input-group input-group-sm admin-inline-tag-input">
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

"use client";

import { Fragment, useState } from "react";
import type { ForumTagSuggestionView } from "@mentor/types";
import { FormSection } from "@/components/shared/admin/FormSection";
import apiClient from "@/lib/apiClient";
import { showForumApiError } from "./forum-helpers";

export function TagSuggestionManager({
    suggestions,
    onChanged,
}: {
    suggestions: ForumTagSuggestionView[];
    onChanged: () => Promise<void>;
}) {
    return (
        <FormSection
            title={`Bekleyen etiket önerileri (${suggestions.length})`}
            hint="Onaylanan öneri havuza eklenir; kullanıcının mevcut sorusuna geriye dönük bağlanmaz."
        >
            {suggestions.length === 0 ? (
                <p className="mb-0 text-muted">Değerlendirilecek etiket önerisi yok.</p>
            ) : (
                suggestions.map((suggestion, index) => (
                    <Fragment key={suggestion.id}>
                        <TagSuggestionRow suggestion={suggestion} onChanged={onChanged} />
                        {index < suggestions.length - 1 ? <hr className="border-dashed my-3" /> : null}
                    </Fragment>
                ))
            )}
        </FormSection>
    );
}

function TagSuggestionRow({
    suggestion,
    onChanged,
}: {
    suggestion: ForumTagSuggestionView;
    onChanged: () => Promise<void>;
}) {
    const [nameTr, setNameTr] = useState(suggestion.requestedName);
    const [nameEn, setNameEn] = useState(suggestion.requestedName);
    const [examType, setExamType] = useState("");
    const [busy, setBusy] = useState(false);

    const review = async (action: "APPROVE" | "REJECT") => {
        setBusy(true);
        try {
            await apiClient.patch(`/admin/forum/tag-suggestions/${suggestion.id}`,
                action === "APPROVE"
                    ? { action, nameTr: nameTr.trim(), nameEn: nameEn.trim(), examType: examType.trim() || null }
                    : { action },
            );
            await onChanged();
        } catch (error) {
            await showForumApiError(error, "Etiket önerisi değerlendirilemedi.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <div className="fw-semibold">
                #{suggestion.normalizedSlug}{" "}
                <span className="fs-12 fw-normal text-muted">
                    ({new Date(suggestion.createdAt).toLocaleDateString("tr-TR")})
                </span>
            </div>
            <p className="fs-12 text-muted mb-3 text-truncate-1-line">{suggestion.requestedName}</p>
            <div className="mb-2">
                <label className="form-label fs-12" htmlFor={`suggestion-tr-${suggestion.id}`}>Türkçe ad</label>
                <input
                    id={`suggestion-tr-${suggestion.id}`}
                    className="form-control form-control-sm"
                    value={nameTr}
                    onChange={(event) => setNameTr(event.target.value)}
                    disabled={busy}
                />
            </div>
            <div className="mb-2">
                <label className="form-label fs-12" htmlFor={`suggestion-en-${suggestion.id}`}>İngilizce ad</label>
                <input
                    id={`suggestion-en-${suggestion.id}`}
                    className="form-control form-control-sm"
                    value={nameEn}
                    onChange={(event) => setNameEn(event.target.value)}
                    disabled={busy}
                />
            </div>
            <div className="mb-3">
                <label className="form-label fs-12" htmlFor={`suggestion-exam-${suggestion.id}`}>Sınav tipi</label>
                <input
                    id={`suggestion-exam-${suggestion.id}`}
                    className="form-control form-control-sm"
                    value={examType}
                    onChange={(event) => setExamType(event.target.value)}
                    placeholder="Tümü"
                    disabled={busy}
                />
            </div>
            <div className="tickets-list-action d-flex align-items-center gap-3">
                <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={busy || !nameTr.trim() || !nameEn.trim()}
                    onClick={() => void review("APPROVE")}
                >
                    Onayla
                </button>
                <span className="text-muted" aria-hidden="true">|</span>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={busy}
                    onClick={() => void review("REJECT")}
                >
                    Reddet
                </button>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FiStar } from "react-icons/fi";
import Swal from "sweetalert2";
import type { ForumFeaturedAdminView, ForumSearchView, ForumThreadSummary } from "@mentor/types";
import { FormSection } from "@/components/shared/admin/FormSection";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import { ZONE_TYPE_LABELS } from "./ZoneForm";
import { showForumApiError } from "./forum-helpers";

export function FeaturedEditor({
    value,
    onChanged,
}: {
    value: ForumFeaturedAdminView | null;
    onChanged: () => Promise<void>;
}) {
    const [selectedThread, setSelectedThread] = useState<ForumThreadSummary | null>(value?.thread ?? null);
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState<ForumThreadSummary[]>([]);
    const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [searchAttempt, setSearchAttempt] = useState(0);
    const latestRequest = useRef(0);
    const [featuredUntil, setFeaturedUntil] = useState(
        value?.featuredUntil ? toLocalDateTime(value.featuredUntil) : defaultFeaturedDate(),
    );
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setSelectedThread(value?.thread ?? null);
        setFeaturedUntil(
            value?.featuredUntil ? toLocalDateTime(value.featuredUntil) : defaultFeaturedDate(),
        );
    }, [value]);

    useEffect(() => {
        const normalizedQuery = query.trim();
        if (normalizedQuery.length < 2) {
            latestRequest.current += 1;
            setSearchResults([]);
            setSearchState("idle");
            return;
        }

        const requestId = latestRequest.current + 1;
        latestRequest.current = requestId;
        const timer = window.setTimeout(async () => {
            setSearchState("loading");
            try {
                const response = await apiClient.get<ForumSearchView>("/forum/search", {
                    params: { q: normalizedQuery },
                });
                if (latestRequest.current !== requestId) return;
                setSearchResults(response.data.threads);
                setSearchState("ready");
            } catch {
                if (latestRequest.current !== requestId) return;
                setSearchResults([]);
                setSearchState("error");
            }
        }, 250);

        return () => window.clearTimeout(timer);
    }, [query, searchAttempt]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (!selectedThread) return;
        setBusy(true);
        try {
            await apiClient.put("/admin/forum/featured-thread", {
                threadId: selectedThread.id,
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
            await showForumApiError(error, "Tartışma öne çıkarılamadı.");
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
            setSelectedThread(null);
            setQuery("");
            setSearchResults([]);
            setSearchState("idle");
            setFeaturedUntil(defaultFeaturedDate());
            await onChanged();
        } catch (error) {
            await showForumApiError(error, "Seçim kaldırılamadı.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <FormSection
            title="Öne çıkan tartışma"
            hint="Manuel seçim yoksa sistem son yedi gündeki etkileşimlerden güvenli bir seçim yapar."
        >
            {value ? (
                <div className="mb-3">
                    <StatusBadge tone="success">Aktif</StatusBadge>
                </div>
            ) : null}
            <form onSubmit={save}>
                <div className="mb-4">
                    {selectedThread ? (
                        <div className="form-label">Seçilen tartışma</div>
                    ) : (
                        <label className="form-label" htmlFor="featured-thread-search">
                            Tartışma ara
                        </label>
                    )}
                    {selectedThread ? (
                        <div className="d-md-flex align-items-center justify-content-between gap-3">
                            <div className="d-flex align-items-center min-w-0">
                                <div className="avatar-text avatar-lg bg-soft-primary text-primary border-soft-primary rounded me-3 flex-shrink-0">
                                    <FiStar size={16} aria-hidden="true" />
                                </div>
                                <ThreadSummary thread={selectedThread} />
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-light flex-shrink-0 mt-2 mt-md-0"
                                disabled={busy}
                                onClick={() => {
                                    setSelectedThread(null);
                                    setQuery("");
                                }}
                            >
                                Değiştir
                            </button>
                        </div>
                    ) : (
                        <FeaturedSearch
                            query={query}
                            searchState={searchState}
                            searchResults={searchResults}
                            busy={busy}
                            onQueryChange={setQuery}
                            onRetry={() => setSearchAttempt((current) => current + 1)}
                            onSelect={(thread) => {
                                setSelectedThread(thread);
                                setQuery("");
                                setSearchResults([]);
                                setSearchState("idle");
                            }}
                        />
                    )}
                </div>
                <div className="row g-3 align-items-end">
                    <div className="col-lg-8">
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
                    <div className="col-lg-4 d-grid">
                        <button type="submit" className="btn btn-primary" disabled={busy || !selectedThread}>
                            {busy ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                    </div>
                </div>
                {value ? (
                    <div className="mt-3 d-flex flex-wrap align-items-center gap-3">
                        <span className="fs-12 text-muted">
                            Bitiş: {value.featuredUntil ? new Date(value.featuredUntil).toLocaleString("tr-TR") : "—"}
                        </span>
                        <button type="button" className="btn btn-sm btn-light" disabled={busy} onClick={() => void clear()}>
                            Manuel seçimi kaldır
                        </button>
                    </div>
                ) : null}
            </form>
        </FormSection>
    );
}

function FeaturedSearch({
    query,
    searchState,
    searchResults,
    busy,
    onQueryChange,
    onRetry,
    onSelect,
}: {
    query: string;
    searchState: "idle" | "loading" | "ready" | "error";
    searchResults: ForumThreadSummary[];
    busy: boolean;
    onQueryChange: (value: string) => void;
    onRetry: () => void;
    onSelect: (thread: ForumThreadSummary) => void;
}) {
    return (
        <div className="position-relative">
            <input
                id="featured-thread-search"
                type="search"
                className="form-control"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Başlık veya içerikte ara"
                autoComplete="off"
                disabled={busy}
                aria-describedby="featured-thread-search-help featured-thread-search-status"
            />
            <div id="featured-thread-search-help" className="form-text">
                Arama en az iki karakterle başlar.
            </div>
            <div id="featured-thread-search-status" className="mt-2" aria-live="polite">
                {searchState === "loading" ? (
                    <div className="d-flex align-items-center gap-2 py-2 text-muted fs-12">
                        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                        Tartışmalar aranıyor…
                    </div>
                ) : null}
                {searchState === "error" ? (
                    <div className="alert alert-warning d-flex align-items-center justify-content-between gap-2 mb-0 py-2">
                        <span>Arama sonuçları alınamadı.</span>
                        <button type="button" className="btn btn-sm btn-outline-dark" onClick={onRetry}>
                            Yeniden dene
                        </button>
                    </div>
                ) : null}
                {searchState === "ready" && searchResults.length === 0 ? (
                    <div className="border rounded py-3 px-3 text-muted fs-12">
                        Bu aramayla eşleşen tartışma bulunamadı.
                    </div>
                ) : null}
                {searchState === "ready" && searchResults.length > 0 ? (
                    <div className="list-group shadow-sm">
                        {searchResults.map((thread) => (
                            <button
                                key={thread.id}
                                type="button"
                                className="list-group-item list-group-item-action text-start"
                                onClick={() => onSelect(thread)}
                            >
                                <ThreadSummary thread={thread} />
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function ThreadSummary({ thread }: { thread: ForumThreadSummary }) {
    return (
        <div className="min-w-0">
            <div className="fw-semibold text-dark text-truncate">
                {thread.title?.trim() || thread.bodyExcerpt}
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2 mt-1 fs-12 text-muted">
                <span>{thread.zoneTitle}</span>
                <span aria-hidden="true">•</span>
                <span>{ZONE_TYPE_LABELS[thread.zoneType] ?? thread.zoneType}</span>
                <span aria-hidden="true">•</span>
                <span>Son hareket {new Date(thread.lastActivityAt).toLocaleString("tr-TR")}</span>
            </div>
        </div>
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

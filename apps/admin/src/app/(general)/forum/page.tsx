"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FiPlus } from "react-icons/fi";
import type {
    ForumFeaturedAdminView,
    ForumTagSuggestionView,
    ForumTagView,
    Paginated,
    ZoneView,
} from "@mentor/types";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import apiClient from "@/lib/apiClient";
import { FeaturedEditor } from "./FeaturedEditor";
import { ForumOverviewStrip } from "./ForumOverviewStrip";
import { TagManager } from "./TagManager";
import { TagSuggestionManager } from "./TagSuggestionManager";
import { ZoneTable } from "./ZoneTable";

export default function ForumManagementPage() {
    const [zones, setZones] = useState<ZoneView[]>([]);
    const [tags, setTags] = useState<ForumTagView[]>([]);
    const [tagSuggestions, setTagSuggestions] = useState<ForumTagSuggestionView[]>([]);
    const [featured, setFeatured] = useState<ForumFeaturedAdminView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        const [zoneResult, tagResult, suggestionResult, featuredResult] = await Promise.allSettled([
            apiClient.get<Paginated<ZoneView>>("/forum/zones?pageSize=100"),
            apiClient.get<ForumTagView[]>("/admin/forum/tags"),
            apiClient.get<ForumTagSuggestionView[]>("/admin/forum/tag-suggestions"),
            apiClient.get<ForumFeaturedAdminView | null>("/admin/forum/featured-thread"),
        ]);
        if (zoneResult.status === "fulfilled") setZones(zoneResult.value.data.items);
        if (tagResult.status === "fulfilled") setTags(tagResult.value.data);
        if (suggestionResult.status === "fulfilled") setTagSuggestions(suggestionResult.value.data);
        if (featuredResult.status === "fulfilled") setFeatured(featuredResult.value.data);
        setError(
            zoneResult.status === "rejected" ||
            tagResult.status === "rejected" ||
            suggestionResult.status === "rejected" ||
            featuredResult.status === "rejected",
        );
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <>
            <AdminPageHeader
                title="Topluluk"
                breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Topluluk" }]}
                actions={
                    <Link href="/forum/new" className="btn btn-primary">
                        <FiPlus aria-hidden="true" /> Yeni oda
                    </Link>
                }
            />
            <div className="main-content">
                {loading ? <ForumPageSkeleton /> : null}
                {!loading && error ? (
                    <div className="alert alert-warning d-flex align-items-center justify-content-between">
                        <span>Bazı topluluk verileri yüklenemedi.</span>
                        <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => void load()}>
                            Yeniden dene
                        </button>
                    </div>
                ) : null}
                {!loading ? (
                    <div className="row g-4">
                        <div className="col-12">
                            <ForumOverviewStrip
                                zoneCount={zones.length}
                                tagCount={tags.length}
                                pendingSuggestionCount={tagSuggestions.length}
                                featuredActive={featured !== null}
                            />
                        </div>
                        <div className="col-xxl-8">
                            <FeaturedEditor value={featured} onChanged={load} />
                        </div>
                        <div className="col-xxl-4">
                            <TagSuggestionManager suggestions={tagSuggestions} onChanged={load} />
                        </div>
                        <div className="col-12">
                            <TagManager tags={tags} onChanged={load} />
                        </div>
                        <div className="col-12">
                            <ZoneTable zones={zones} />
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );
}

function ForumPageSkeleton() {
    return (
        <div className="row g-4" aria-busy="true">
            <div className="col-12">
                <div className="card stretch stretch-full">
                    <div className="card-body">
                        <AsyncState status="loading" size="compact" title="Topluluk özeti yükleniyor" />
                    </div>
                </div>
            </div>
            <div className="col-xxl-8">
                <div className="card stretch stretch-full">
                    <div className="card-body">
                        <AsyncState status="loading" size="compact" title="Öne çıkan tartışma yükleniyor" />
                    </div>
                </div>
            </div>
            <div className="col-xxl-4">
                <div className="card stretch stretch-full">
                    <div className="card-body">
                        <AsyncState status="loading" size="compact" title="Etiket önerileri yükleniyor" />
                    </div>
                </div>
            </div>
            <div className="col-12">
                <div className="card stretch stretch-full">
                    <div className="card-body">
                        <AsyncState status="loading" size="compact" title="Etiketler yükleniyor" />
                    </div>
                </div>
            </div>
            <div className="col-12">
                <div className="card stretch stretch-full">
                    <div className="card-body">
                        <AsyncState status="loading" size="compact" title="Odalar yükleniyor" />
                    </div>
                </div>
            </div>
        </div>
    );
}

'use client'

/* eslint-disable @next/next/no-img-element -- admin preview uses storage-provided dimensions */

import type { ChangeEvent } from "react";
import { FormSection } from "@/components/shared/admin/FormSection";
import type { AdminArticle } from "@/lib/types";

type UploadKind = "COVER" | "BODY" | "GALLERY";
type GalleryImage = AdminArticle["galleryImages"][number];

interface ArticleMediaSectionProps {
    acceptedImages: string;
    coverImageAlt: string;
    coverImageKey: string;
    coverImageUrl: string;
    galleryImages: GalleryImage[];
    galleryMax: number;
    uploading: UploadKind | null;
    onCoverAltChange: (value: string) => void;
    onCoverRemove: () => void;
    onCoverUpload: (event: ChangeEvent<HTMLInputElement>) => void;
    onGalleryAltChange: (index: number, value: string) => void;
    onGalleryMove: (index: number, direction: -1 | 1) => void;
    onGalleryRemove: (index: number) => void;
    onGalleryUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function ArticleMediaSection({
    acceptedImages,
    coverImageAlt,
    coverImageKey,
    coverImageUrl,
    galleryImages,
    galleryMax,
    uploading,
    onCoverAltChange,
    onCoverRemove,
    onCoverUpload,
    onGalleryAltChange,
    onGalleryMove,
    onGalleryRemove,
    onGalleryUpload,
}: ArticleMediaSectionProps) {
    return (
        <FormSection title="Görseller" hint="Kapak görseli paylaşım önizlemelerinde kullanılır. Tüm görseller açıklayıcı alt metin taşımalıdır.">
            <div className="row g-3">
                <div className="col-12"><h3 className="h6 mb-0">Kapak ve sosyal paylaşım görseli</h3></div>
                <div className="col-md-5">
                    {coverImageUrl ? <img src={coverImageUrl} alt={coverImageAlt || "Kapak önizlemesi"} className="img-fluid rounded border mb-2 admin-article-cover-preview" /> : <div className="border rounded p-4 text-muted">Kapak yüklenmedi</div>}
                </div>
                <div className="col-md-7">
                    <label className="form-label" htmlFor="article-cover-alt">Kapak alt metni</label>
                    <input id="article-cover-alt" className="form-control mb-2" value={coverImageAlt} onChange={(event) => onCoverAltChange(event.target.value)} required={Boolean(coverImageKey)} />
                    <div className="d-flex gap-2">
                        <label className="btn btn-light mb-0">{uploading === "COVER" ? "Yükleniyor…" : "Kapak yükle"}<input hidden type="file" accept={acceptedImages} disabled={uploading !== null} onChange={onCoverUpload} /></label>
                        {coverImageKey ? <button type="button" className="btn btn-outline-danger" onClick={onCoverRemove}>Kaldır</button> : null}
                    </div>
                </div>

                <div className="col-12"><hr className="my-1" /><h3 className="h6 mb-0">Ek banner görselleri <span className="text-muted fw-normal">({galleryImages.length}/{galleryMax})</span></h3></div>
                <div className="col-12">
                    <div className="d-flex flex-wrap gap-3">
                        {galleryImages.map((image, index) => (
                            <div key={image.key} className="border rounded p-2 admin-article-gallery-item">
                                <img src={image.url} alt={image.alt} className="img-fluid rounded mb-2" />
                                <input className="form-control form-control-sm mb-2" value={image.alt} onChange={(event) => onGalleryAltChange(index, event.target.value)} placeholder="Alt metin" aria-label={`${index + 1}. galeri görseli alt metni`} required />
                                <div className="d-flex gap-1">
                                    <button type="button" className="btn btn-sm btn-light" aria-label={`${index + 1}. görseli sola taşı`} disabled={index === 0} onClick={() => onGalleryMove(index, -1)}>↑</button>
                                    <button type="button" className="btn btn-sm btn-light" aria-label={`${index + 1}. görseli sağa taşı`} disabled={index === galleryImages.length - 1} onClick={() => onGalleryMove(index, 1)}>↓</button>
                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onGalleryRemove(index)}>Sil</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <label className="btn btn-light mt-2 mb-0">
                        {uploading === "GALLERY" ? "Yükleniyor…" : "Ek görsel ekle"}
                        <input hidden type="file" accept={acceptedImages} disabled={uploading !== null || galleryImages.length >= galleryMax} onChange={onGalleryUpload} />
                    </label>
                </div>
            </div>
        </FormSection>
    );
}

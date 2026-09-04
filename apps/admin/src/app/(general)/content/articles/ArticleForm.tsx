'use client'

/* eslint-disable @next/next/no-img-element -- admin preview uses storage-provided dimensions */

import dynamic from "next/dynamic";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { FieldLabel } from "@/components/shared/admin/FieldLabel";
import { FormSection } from "@/components/shared/admin/FormSection";
import apiClient from "@/lib/apiClient";
import type { AdminArticle } from "@/lib/types";
import { ArticleMediaSection } from "./ArticleMediaSection";
import { ACCEPTED_IMAGES, escapeAttribute, imageDimensions, resolveUploadUrl, uploadArticleImage } from "./article-image-utils";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });
const FAMILIES = ["KPSS", "YKS", "LGS"];
const CATEGORIES = [
    { value: "EXAM_PROCESS", label: "Sınav süreci" },
    { value: "APPLICATION", label: "Başvuru" },
    { value: "GENERAL", label: "Genel" },
] as const;
const FEATURED_DAYS = [1, 3, 7, 14] as const;
const GALLERY_MAX = 4;

const toLocalInput = (iso?: string) => {
    const date = iso ? new Date(iso) : new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function ArticleForm({ initial }: { initial?: AdminArticle | null }) {
    const router = useRouter();
    const editing = Boolean(initial);
    const [form, setForm] = useState({
        slug: initial?.slug ?? "",
        title: initial?.title ?? "",
        family: initial?.family ?? "KPSS",
        category: initial?.category ?? "APPLICATION",
        body: initial?.editorBodyHtml ?? initial?.body ?? "<p></p>",
        source: initial?.source ?? "",
        sourceUrl: initial?.sourceUrl ?? "",
        verifiedBy: initial?.verifiedBy ?? "",
        verifiedAt: toLocalInput(initial?.verifiedAt),
        metaTitle: initial?.metaTitle ?? "",
        metaDescription: initial?.metaDescription ?? "",
        authorName: initial?.authorName ?? "",
        authorTitle: initial?.authorTitle ?? "",
        authorBio: initial?.authorBio ?? "",
        coverImageKey: initial?.coverImageKey ?? "",
        coverImageUrl: initial?.coverImageUrl ? resolveUploadUrl(initial.coverImageUrl) : "",
        coverImageAlt: initial?.coverImageAlt ?? "",
        coverImageWidth: initial?.coverImageWidth ?? 0,
        coverImageHeight: initial?.coverImageHeight ?? 0,
        isFeatured: initial?.isFeatured ?? false,
        featuredDays: 7 as (typeof FEATURED_DAYS)[number],
        galleryImages: (initial?.galleryImages ?? []).map((image) => ({
            ...image,
            url: resolveUploadUrl(image.url),
        })),
    });
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState<"COVER" | "BODY" | "GALLERY" | null>(null);
    const [bodyImageAlt, setBodyImageAlt] = useState("");
    const editorConfig = useMemo(() => ({
        toolbarAdaptive: false,
        buttons: ["paragraph", "bold", "italic", "ul", "ol", "blockquote", "link", "table", "image", "undo", "redo"],
        removeButtons: ["source", "fullsize", "video", "file", "font", "fontsize", "classSpan", "copyformat", "about"],
        disablePlugins: ["source"],
        uploader: { insertImageAsBase64URI: false },
        controls: {
            paragraph: {
                list: { p: "Paragraf", h2: "Başlık 2", h3: "Başlık 3" },
            },
        },
        height: 420,
    }), []);
    const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
        setForm((current) => ({ ...current, [key]: event.target.value }));
    const updateGalleryAlt = (index: number, alt: string) => setForm((current) => ({
        ...current,
        galleryImages: current.galleryImages.map((item, itemIndex) => itemIndex === index ? { ...item, alt } : item),
    }));
    const moveGalleryImage = (index: number, direction: -1 | 1) => setForm((current) => {
        const next = [...current.galleryImages];
        [next[index + direction], next[index]] = [next[index], next[index + direction]];
        return { ...current, galleryImages: next };
    });

    const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setUploading("COVER");
        try {
            const [uploaded, dimensions] = await Promise.all([
                uploadArticleImage(file, "COVER"),
                imageDimensions(file),
            ]);
            setForm((current) => ({
                ...current,
                coverImageKey: uploaded.key,
                coverImageUrl: resolveUploadUrl(uploaded.publicUrl),
                coverImageWidth: dimensions.width,
                coverImageHeight: dimensions.height,
            }));
        } catch (error) {
            await Swal.fire({ icon: "error", title: "Yükleme hatası", text: error instanceof Error ? error.message : "Görsel yüklenemedi." });
        } finally {
            setUploading(null);
        }
    };

    const uploadBodyImage = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!bodyImageAlt.trim()) {
            await Swal.fire({ icon: "warning", title: "Alt metin gerekli", text: "Gövde görselini yüklemeden önce açıklayıcı alt metni yazın." });
            return;
        }
        setUploading("BODY");
        try {
            const uploaded = await uploadArticleImage(file, "BODY");
            const imageHtml = `<p><img src="${escapeAttribute(uploaded.publicUrl)}" alt="${escapeAttribute(bodyImageAlt.trim())}"></p>`;
            setForm((current) => ({ ...current, body: `${current.body}${imageHtml}` }));
            setBodyImageAlt("");
        } catch (error) {
            await Swal.fire({ icon: "error", title: "Yükleme hatası", text: error instanceof Error ? error.message : "Görsel yüklenemedi." });
        } finally {
            setUploading(null);
        }
    };

    const uploadGalleryImage = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (form.galleryImages.length >= GALLERY_MAX) {
            await Swal.fire({ icon: "warning", title: "Limit", text: `En fazla ${GALLERY_MAX} ek görsel.` });
            return;
        }
        setUploading("GALLERY");
        try {
            const [uploaded, dimensions] = await Promise.all([
                uploadArticleImage(file, "GALLERY"),
                imageDimensions(file),
            ]);
            setForm((current) => ({
                ...current,
                galleryImages: [
                    ...current.galleryImages,
                    {
                        key: uploaded.key,
                        url: resolveUploadUrl(uploaded.publicUrl),
                        alt: current.title || "Galeri görseli",
                        width: dimensions.width,
                        height: dimensions.height,
                    },
                ],
            }));
        } catch (error) {
            await Swal.fire({ icon: "error", title: "Yükleme hatası", text: error instanceof Error ? error.message : "Görsel yüklenemedi." });
        } finally {
            setUploading(null);
        }
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try {
            await apiClient.post("/admin/content/articles", {
                slug: form.slug,
                title: form.title,
                family: form.family,
                category: form.category,
                body: form.body,
                bodyFormat: "HTML",
                source: form.source,
                sourceUrl: form.sourceUrl,
                verifiedBy: form.verifiedBy,
                verifiedAt: new Date(form.verifiedAt).toISOString(),
                metaTitle: form.metaTitle || undefined,
                metaDescription: form.metaDescription || undefined,
                authorName: form.authorName || null,
                authorTitle: form.authorTitle || null,
                authorBio: form.authorBio || null,
                coverImageKey: form.coverImageKey || null,
                coverImageAlt: form.coverImageKey ? form.coverImageAlt : null,
                coverImageWidth: form.coverImageKey ? form.coverImageWidth : null,
                coverImageHeight: form.coverImageKey ? form.coverImageHeight : null,
                isFeatured: form.isFeatured,
                featuredDays: form.isFeatured ? form.featuredDays : undefined,
                galleryImages: form.galleryImages.map(({ key, alt, width, height }) => ({
                    key, alt, width, height,
                })),
            });
            await Swal.fire({ icon: "success", title: "Kaydedildi", timer: 1100, showConfirmButton: false });
            router.push("/content/articles");
        } catch (error) {
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Kaydedilemedi.";
            await Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} aria-busy={busy || uploading !== null}>
            <div className="row g-4 align-items-start">
                <div className="col-xl-8">
            <FormSection title="İçerik ve sınıflandırma" hint="Makalenin adresini, kapsamını ve okuyucuya sunulacak ana içeriği yönetin.">
                <div className="row g-3">
                    <div className="col-md-6"><FieldLabel htmlFor="article-slug" label="Slug" required hint="Makalenin kalıcı adresidir. Düzenleme sırasında değiştirilemez." /><input id="article-slug" className="form-control" value={form.slug} onChange={set("slug")} disabled={editing} required placeholder="kpss-basvuru-rehberi" /></div>
                    <div className="col-md-6"><FieldLabel htmlFor="article-title" label="Başlık" required /><input id="article-title" className="form-control" value={form.title} onChange={set("title")} required /></div>
                    <div className="col-md-3"><label className="form-label">Sınav</label><select className="form-select" value={form.family} onChange={set("family")}>{FAMILIES.map((item) => <option key={item}>{item}</option>)}</select></div>
                    <div className="col-md-3"><FieldLabel htmlFor="article-category" label="Kategori" required /><select id="article-category" className="form-select" value={form.category} onChange={set("category")}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                    <div className="col-12">
                        <label className="form-label">Gövde</label>
                        <JoditEditor value={form.body} config={editorConfig} onBlur={(body) => setForm((current) => ({ ...current, body }))} />
                        <div className="row g-2 mt-1 align-items-end">
                            <div className="col-md-6"><label className="form-label fs-12">Gövde görseli alt metni</label><input className="form-control" value={bodyImageAlt} onChange={(event) => setBodyImageAlt(event.target.value)} /></div>
                            <div className="col-md-6"><label className="btn btn-light mb-0">{uploading === "BODY" ? "Yükleniyor…" : "Gövdeye görsel ekle"}<input hidden type="file" accept={ACCEPTED_IMAGES} disabled={uploading !== null} onChange={uploadBodyImage} /></label></div>
                        </div>
                    </div>

                </div>
            </FormSection>

            <ArticleMediaSection
                acceptedImages={ACCEPTED_IMAGES}
                coverImageAlt={form.coverImageAlt}
                coverImageKey={form.coverImageKey}
                coverImageUrl={form.coverImageUrl}
                galleryImages={form.galleryImages}
                galleryMax={GALLERY_MAX}
                uploading={uploading}
                onCoverAltChange={(coverImageAlt) => setForm((current) => ({ ...current, coverImageAlt }))}
                onCoverRemove={() => setForm((current) => ({ ...current, coverImageKey: "", coverImageUrl: "", coverImageAlt: "", coverImageWidth: 0, coverImageHeight: 0 }))}
                onCoverUpload={uploadCover}
                onGalleryAltChange={updateGalleryAlt}
                onGalleryMove={moveGalleryImage}
                onGalleryRemove={(index) => setForm((current) => ({ ...current, galleryImages: current.galleryImages.filter((_, itemIndex) => itemIndex !== index) }))}
                onGalleryUpload={uploadGalleryImage}
            />

            <FormSection title="Yazar" hint="Yazar bilgisi verilmezse makale kurumsal içerik olarak gösterilir.">
                <div className="row g-3">
                    <div className="col-md-4"><label className="form-label">Ad soyad</label><input className="form-control" value={form.authorName} onChange={set("authorName")} /></div>
                    <div className="col-md-4"><label className="form-label">Unvan</label><input className="form-control" value={form.authorTitle} onChange={set("authorTitle")} /></div>
                    <div className="col-md-4"><label className="form-label">Kısa biyografi</label><input className="form-control" value={form.authorBio} onChange={set("authorBio")} /></div>
                </div>
            </FormSection>
                </div>

                <div className="col-xl-4">
                    <div className="admin-form-rail">
            <FormSection title="Kaynak ve doğrulama" hint="Resmî süreç ve tarih bilgileri serbest metin olarak üretilemez; doğrulanmış kaynağa dayanmalıdır.">
                <div className="alert alert-warning" role="note"><strong>Doğrulama zorunlu.</strong> Kaynak bağlantısı ve doğrulayan kişi yayın güven hattının parçasıdır.</div>
                <div className="row g-3">
                    <div className="col-12"><FieldLabel htmlFor="article-source" label="Kaynak" required /><input id="article-source" className="form-control" value={form.source} onChange={set("source")} required placeholder="ÖSYM" /></div>
                    <div className="col-12"><FieldLabel htmlFor="article-source-url" label="Kaynak bağlantısı" required /><input id="article-source-url" className="form-control" type="url" value={form.sourceUrl} onChange={set("sourceUrl")} required /></div>
                    <div className="col-12"><FieldLabel htmlFor="article-verifier" label="Doğrulayan" required /><input id="article-verifier" className="form-control" value={form.verifiedBy} onChange={set("verifiedBy")} required /></div>
                    <div className="col-12"><FieldLabel htmlFor="article-verified-at" label="Doğrulama tarihi" required /><input id="article-verified-at" className="form-control" type="datetime-local" value={form.verifiedAt} onChange={set("verifiedAt")} required /></div>
                </div>
            </FormSection>

            <FormSection title="Arama görünümü" hint="Boş bırakılan alanlarda makale başlığı ve varsayılan açıklama kullanılır.">
                <div className="row g-3">
                    <div className="col-12"><label className="form-label">Meta başlık <span className="text-muted">{form.metaTitle.length}/60</span></label><input className="form-control" value={form.metaTitle} onChange={set("metaTitle")} maxLength={60} /></div>
                    <div className="col-12"><label className="form-label">Meta açıklama <span className="text-muted">{form.metaDescription.length}/160</span></label><textarea className="form-control" rows={3} value={form.metaDescription} onChange={set("metaDescription")} maxLength={160} /></div>
                    <div className="col-12"><div className="border rounded p-3"><div className="text-primary fs-5">{form.metaTitle || form.title || "Makale başlığı"}</div><div className="text-success fs-12">mentor.app/tr/bilgi/{form.slug || "makale-slug"}</div><p className="mb-0 text-muted">{form.metaDescription || "Arama ve sosyal paylaşım açıklaması burada görünür."}</p></div></div>
                </div>
            </FormSection>

            <FormSection title="Yayın ayarları" footer={<div className="d-grid gap-2"><button type="submit" className="btn btn-primary admin-submit-button" disabled={busy || uploading !== null}>{busy ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Kaydediliyor…</> : editing ? "Makaleyi güncelle" : "Makaleyi oluştur"}</button><button type="button" className="btn btn-light" disabled={busy} onClick={() => router.push("/content/articles")}>Vazgeç</button></div>}>
                <div className="admin-publish-control">
                    <div><strong>Öne çıkar</strong><span>Bu sınav ailesinin öne çıkan yazısı olur.</span></div>
                    <div className="form-check form-switch mb-0"><input id="isFeatured" className="form-check-input" type="checkbox" role="switch" checked={form.isFeatured} onChange={(event) => setForm((current) => ({ ...current, isFeatured: event.target.checked }))} /></div>
                </div>
                <div className="mt-3">
                    <FieldLabel htmlFor="featured-days" label="Öne çıkarma süresi" />
                    <select id="featured-days" className="form-select" value={form.featuredDays} disabled={!form.isFeatured} onChange={(event) => setForm((current) => ({ ...current, featuredDays: Number(event.target.value) as (typeof FEATURED_DAYS)[number] }))}>{FEATURED_DAYS.map((days) => <option key={days} value={days}>{days} gün</option>)}</select>
                </div>
            </FormSection>
                    </div>
                </div>
            </div>
        </form>
    );
}

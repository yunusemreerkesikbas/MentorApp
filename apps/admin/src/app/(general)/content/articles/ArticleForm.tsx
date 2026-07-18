'use client'

/* eslint-disable @next/next/no-img-element -- admin preview uses storage-provided dimensions */

import dynamic from "next/dynamic";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import apiClient from "@/lib/apiClient";
import type { AdminArticle, ArticleImageUploadUrl } from "@/lib/types";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });
const FAMILIES = ["KPSS", "YKS", "LGS"];
const CATEGORIES = ["EXAM_PROCESS", "APPLICATION", "GENERAL"];
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ACCEPTED_IMAGES = ACCEPTED_IMAGE_TYPES.join(",");

const toLocalInput = (iso?: string) => {
    const date = iso ? new Date(iso) : new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const escapeAttribute = (value: string) => value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const resolveUploadUrl = (url: string) => {
    if (/^https?:\/\//.test(url)) return url;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";
    return new URL(url, apiUrl).toString();
};

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
    const objectUrl = URL.createObjectURL(file);
    try {
        return await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = reject;
            image.src = objectUrl;
        });
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

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
    });
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState<"COVER" | "BODY" | null>(null);
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

    const uploadImage = async (file: File, purpose: "COVER" | "BODY") => {
        if (file.size > 5 * 1024 * 1024) throw new Error("Görsel en fazla 5 MB olabilir.");
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
            throw new Error("Yalnız JPEG, PNG veya WebP yüklenebilir.");
        }
        const { data } = await apiClient.post<ArticleImageUploadUrl>("/admin/content/articles/images/upload-url", {
            purpose,
            contentType: file.type,
        });
        const response = await fetch(resolveUploadUrl(data.uploadUrl), {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
        });
        if (!response.ok) throw new Error("Görsel yüklenemedi.");
        return data;
    };

    const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setUploading("COVER");
        try {
            const [uploaded, dimensions] = await Promise.all([
                uploadImage(file, "COVER"),
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
            const uploaded = await uploadImage(file, "BODY");
            const imageHtml = `<p><img src="${escapeAttribute(uploaded.publicUrl)}" alt="${escapeAttribute(bodyImageAlt.trim())}"></p>`;
            setForm((current) => ({ ...current, body: `${current.body}${imageHtml}` }));
            setBodyImageAlt("");
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
                ...form,
                bodyFormat: "HTML",
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
                coverImageUrl: undefined,
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
        <form onSubmit={submit} className="card stretch stretch-full">
            <div className="card-body">
                <div className="row g-3">
                    <div className="col-md-6"><label className="form-label">Slug</label><input className="form-control" value={form.slug} onChange={set("slug")} disabled={editing} required placeholder="kpss-basvuru-rehberi" /></div>
                    <div className="col-md-6"><label className="form-label">Başlık</label><input className="form-control" value={form.title} onChange={set("title")} required /></div>
                    <div className="col-md-3"><label className="form-label">Sınav</label><select className="form-select" value={form.family} onChange={set("family")}>{FAMILIES.map((item) => <option key={item}>{item}</option>)}</select></div>
                    <div className="col-md-3"><label className="form-label">Kategori</label><select className="form-select" value={form.category} onChange={set("category")}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></div>

                    <div className="col-12">
                        <label className="form-label">Gövde</label>
                        <JoditEditor value={form.body} config={editorConfig} onBlur={(body) => setForm((current) => ({ ...current, body }))} />
                        <div className="row g-2 mt-1 align-items-end">
                            <div className="col-md-6"><label className="form-label fs-12">Gövde görseli alt metni</label><input className="form-control" value={bodyImageAlt} onChange={(event) => setBodyImageAlt(event.target.value)} /></div>
                            <div className="col-md-6"><label className="btn btn-light mb-0">{uploading === "BODY" ? "Yükleniyor…" : "Gövdeye görsel ekle"}<input hidden type="file" accept={ACCEPTED_IMAGES} disabled={uploading !== null} onChange={uploadBodyImage} /></label></div>
                        </div>
                    </div>

                    <div className="col-12"><hr className="my-1" /><span className="fs-12 text-muted">Kapak ve sosyal paylaşım görseli</span></div>
                    <div className="col-md-5">
                        {form.coverImageUrl ? <img src={form.coverImageUrl} alt={form.coverImageAlt || "Kapak önizlemesi"} className="img-fluid rounded border mb-2" style={{ maxHeight: 220 }} /> : <div className="border rounded p-4 text-muted">Kapak yüklenmedi</div>}
                    </div>
                    <div className="col-md-7">
                        <label className="form-label">Kapak alt metni</label><input className="form-control mb-2" value={form.coverImageAlt} onChange={set("coverImageAlt")} required={Boolean(form.coverImageKey)} />
                        <div className="d-flex gap-2"><label className="btn btn-light mb-0">{uploading === "COVER" ? "Yükleniyor…" : "Kapak yükle"}<input hidden type="file" accept={ACCEPTED_IMAGES} disabled={uploading !== null} onChange={uploadCover} /></label>{form.coverImageKey && <button type="button" className="btn btn-outline-danger" onClick={() => setForm((current) => ({ ...current, coverImageKey: "", coverImageUrl: "", coverImageAlt: "", coverImageWidth: 0, coverImageHeight: 0 }))}>Kaldır</button>}</div>
                    </div>

                    <div className="col-12"><hr className="my-1" /><span className="fs-12 text-muted">Yazar (opsiyonel)</span></div>
                    <div className="col-md-4"><label className="form-label">Ad soyad</label><input className="form-control" value={form.authorName} onChange={set("authorName")} /></div>
                    <div className="col-md-4"><label className="form-label">Unvan</label><input className="form-control" value={form.authorTitle} onChange={set("authorTitle")} /></div>
                    <div className="col-md-4"><label className="form-label">Kısa biyografi</label><input className="form-control" value={form.authorBio} onChange={set("authorBio")} /></div>

                    <div className="col-12"><hr className="my-1" /><span className="fs-12 text-muted">Güven bilgisi (zorunlu)</span></div>
                    <div className="col-md-4"><label className="form-label">Kaynak</label><input className="form-control" value={form.source} onChange={set("source")} required placeholder="ÖSYM" /></div>
                    <div className="col-md-4"><label className="form-label">Kaynak URL</label><input className="form-control" type="url" value={form.sourceUrl} onChange={set("sourceUrl")} required /></div>
                    <div className="col-md-4"><label className="form-label">Doğrulayan</label><input className="form-control" value={form.verifiedBy} onChange={set("verifiedBy")} required /></div>
                    <div className="col-md-4"><label className="form-label">Doğrulama tarihi</label><input className="form-control" type="datetime-local" value={form.verifiedAt} onChange={set("verifiedAt")} required /></div>

                    <div className="col-12"><hr className="my-1" /><span className="fs-12 text-muted">SEO ve paylaşım önizlemesi</span></div>
                    <div className="col-md-6"><label className="form-label">Meta başlık <span className="text-muted">{form.metaTitle.length}/60</span></label><input className="form-control" value={form.metaTitle} onChange={set("metaTitle")} /></div>
                    <div className="col-md-6"><label className="form-label">Meta açıklama <span className="text-muted">{form.metaDescription.length}/160</span></label><textarea className="form-control" rows={3} value={form.metaDescription} onChange={set("metaDescription")} /></div>
                    <div className="col-12"><div className="border rounded p-3"><div className="text-primary fs-5">{form.metaTitle || form.title || "Makale başlığı"}</div><div className="text-success fs-12">mentor.app/tr/bilgi/{form.slug || "makale-slug"}</div><p className="mb-0 text-muted">{form.metaDescription || "Arama ve sosyal paylaşım açıklaması burada görünür."}</p></div></div>
                </div>
                <div className="mt-3 d-flex gap-2"><button type="submit" className="btn btn-primary" disabled={busy || uploading !== null}>{editing ? "Güncelle" : "Oluştur"}</button><button type="button" className="btn btn-light" onClick={() => router.push("/content/articles")}>İptal</button></div>
            </div>
        </form>
    );
}

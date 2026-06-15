'use client'
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import apiClient from "@/lib/apiClient";
import type { AdminArticle } from "@/lib/types";

const FAMILIES = ["KPSS", "YKS", "LGS"];
const CATEGORIES = ["EXAM_PROCESS", "APPLICATION", "GENERAL"];

const toLocalInput = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Editorial article form (§4 #1): trust metadata required; body is markdown (web renders via react-markdown).
export default function ArticleForm({ initial }: { initial?: AdminArticle | null }) {
    const router = useRouter();
    const editing = !!initial;
    const [f, setF] = useState({
        slug: initial?.slug ?? "",
        title: initial?.title ?? "",
        family: initial?.family ?? "KPSS",
        category: initial?.category ?? "APPLICATION",
        body: initial?.body ?? "",
        source: initial?.source ?? "",
        sourceUrl: initial?.sourceUrl ?? "",
        verifiedBy: initial?.verifiedBy ?? "",
        verifiedAt: toLocalInput(initial?.verifiedAt),
        metaTitle: initial?.metaTitle ?? "",
        metaDescription: initial?.metaDescription ?? "",
    });
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await apiClient.post("/admin/content/articles", {
                ...f,
                verifiedAt: new Date(f.verifiedAt).toISOString(),
                metaTitle: f.metaTitle || undefined,
                metaDescription: f.metaDescription || undefined,
            });
            await Swal.fire({ icon: "success", title: "Kaydedildi", timer: 1100, showConfirmButton: false });
            router.push("/content/articles");
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Kaydedilemedi.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="card stretch stretch-full">
            <div className="card-body">
                <div className="row g-3">
                    <div className="col-md-6">
                        <label className="form-label">Slug</label>
                        <input className="form-control" value={f.slug} onChange={set("slug")} disabled={editing} required placeholder="kpss-basvuru-rehberi" />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Başlık</label>
                        <input className="form-control" value={f.title} onChange={set("title")} required />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Sınav</label>
                        <select className="form-select" value={f.family} onChange={set("family")}>
                            {FAMILIES.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Kategori</label>
                        <select className="form-select" value={f.category} onChange={set("category")}>
                            {CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                    </div>
                    <div className="col-12">
                        <label className="form-label">Gövde (Markdown)</label>
                        <textarea className="form-control" rows={10} value={f.body} onChange={set("body")} required style={{ fontFamily: "monospace" }} />
                    </div>
                    <div className="col-12"><hr className="my-1" /><span className="fs-12 text-muted">Güven bilgisi (§4 — zorunlu)</span></div>
                    <div className="col-md-4">
                        <label className="form-label">Kaynak</label>
                        <input className="form-control" value={f.source} onChange={set("source")} required placeholder="ÖSYM" />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Kaynak URL</label>
                        <input className="form-control" type="url" value={f.sourceUrl} onChange={set("sourceUrl")} required placeholder="https://osym.gov.tr/..." />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Doğrulayan</label>
                        <input className="form-control" value={f.verifiedBy} onChange={set("verifiedBy")} required />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Doğrulama tarihi</label>
                        <input className="form-control" type="datetime-local" value={f.verifiedAt} onChange={set("verifiedAt")} required />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Meta başlık (SEO)</label>
                        <input className="form-control" value={f.metaTitle} onChange={set("metaTitle")} />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Meta açıklama (SEO)</label>
                        <input className="form-control" value={f.metaDescription} onChange={set("metaDescription")} />
                    </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={busy}>{editing ? "Güncelle" : "Oluştur"}</button>
                    <button type="button" className="btn btn-light" onClick={() => router.push("/content/articles")}>İptal</button>
                </div>
            </div>
        </form>
    );
}

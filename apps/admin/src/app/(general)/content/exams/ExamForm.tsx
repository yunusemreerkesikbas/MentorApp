'use client'
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import apiClient from "@/lib/apiClient";
import type { AdminExam } from "@/lib/types";

const FAMILIES = ["KPSS", "YKS", "LGS"];
const VARIANTS = ["", "LISANS", "ONLISANS", "ORTAOGRETIM"];

// Editorial exam form. Idempotent upsert by slug; netRule is the net-scoring penalty divisor.
export default function ExamForm({ initial }: { initial?: AdminExam | null }) {
    const router = useRouter();
    const editing = !!initial;
    const [f, setF] = useState({
        slug: initial?.slug ?? "",
        name: initial?.name ?? "",
        family: initial?.family ?? "KPSS",
        variant: initial?.variant ?? "",
        divisor: String(initial?.netRule?.divisor ?? 4),
        isCurrent: initial?.isCurrent ?? false,
    });
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await apiClient.post("/admin/content/exams", {
                slug: f.slug,
                name: f.name,
                family: f.family,
                variant: f.variant || null,
                netRule: { kind: "PENALTY", divisor: Number(f.divisor) },
                isCurrent: f.isCurrent,
            });
            await Swal.fire({ icon: "success", title: "Kaydedildi", timer: 1100, showConfirmButton: false });
            router.push("/content/exams");
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
                        <input className="form-control" value={f.slug} onChange={set("slug")} disabled={editing} required placeholder="kpss-2026-lisans" />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Ad</label>
                        <input className="form-control" value={f.name} onChange={set("name")} required placeholder="KPSS 2026 Lisans" />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Sınav</label>
                        <select className="form-select" value={f.family} onChange={set("family")}>
                            {FAMILIES.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Tür (varyant)</label>
                        <select className="form-select" value={f.variant} onChange={set("variant")}>
                            {VARIANTS.map((x) => <option key={x} value={x}>{x || "—"}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Net kuralı (ceza böleni)</label>
                        <input className="form-control" type="number" min={1} value={f.divisor} onChange={set("divisor")} required />
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                        <div className="form-check">
                            <input className="form-check-input" type="checkbox" id="isCurrent" checked={f.isCurrent} onChange={(e) => setF((p) => ({ ...p, isCurrent: e.target.checked }))} />
                            <label className="form-check-label" htmlFor="isCurrent">Güncel sınav</label>
                        </div>
                    </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={busy}>{editing ? "Güncelle" : "Oluştur"}</button>
                    <button type="button" className="btn btn-light" onClick={() => router.push("/content/exams")}>İptal</button>
                </div>
            </div>
        </form>
    );
}

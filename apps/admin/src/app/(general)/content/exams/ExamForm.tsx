'use client'
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { FieldLabel } from "@/components/shared/admin/FieldLabel";
import { FormSection } from "@/components/shared/admin/FormSection";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
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
        <form onSubmit={submit} aria-busy={busy}>
            <div className="row g-4 align-items-start">
                <div className="col-xl-8">
                    <FormSection title="Sınav bilgileri">
                        <div className="row g-4">
                            <div className="col-md-6">
                                <FieldLabel htmlFor="exam-slug" label="Slug" required hint={editing ? "Bağlantılar ve takvim kayıtları bu değeri kullandığı için düzenleme sırasında değiştirilemez." : "URL ve API kayıtlarında kullanılan benzersiz, küçük harfli tanımlayıcı."} />
                                <input id="exam-slug" className="form-control" value={f.slug} onChange={set("slug")} disabled={editing} required placeholder="kpss-2026-lisans" />
                            </div>
                            <div className="col-md-6">
                                <FieldLabel htmlFor="exam-name" label="Sınav adı" required />
                                <input id="exam-name" className="form-control" value={f.name} onChange={set("name")} required placeholder="KPSS 2026 Lisans" />
                            </div>
                            <div className="col-md-6">
                                <FieldLabel htmlFor="exam-family" label="Sınav ailesi" required />
                                <select id="exam-family" className="form-select" value={f.family} onChange={set("family")}>
                                    {FAMILIES.map((family) => <option key={family} value={family}>{family}</option>)}
                                </select>
                            </div>
                            <div className="col-md-6">
                                <FieldLabel htmlFor="exam-variant" label="Varyant" hint="Yalnız sınav ailesinin lisans, ön lisans veya ortaöğretim gibi ayrı bir kapsamı varsa seçilir." />
                                <select id="exam-variant" className="form-select" value={f.variant} onChange={set("variant")}>
                                    {VARIANTS.map((variant) => <option key={variant} value={variant}>{variant || "Varyant yok"}</option>)}
                                </select>
                            </div>
                        </div>
                    </FormSection>
                </div>
                <div className="col-xl-4">
                    <div className="admin-form-rail">
                        <FormSection
                            title="Puanlama ve durum"
                            footer={
                                <div className="d-grid gap-2">
                                    <button type="submit" className="btn btn-primary admin-submit-button" disabled={busy}>
                                        {busy ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : null}
                                        <span>{busy ? "Kaydediliyor…" : editing ? "Sınavı güncelle" : "Sınavı oluştur"}</span>
                                    </button>
                                    <Link href="/content/exams" className="btn btn-light">Vazgeç</Link>
                                </div>
                            }
                        >
                            <div className="mb-4">
                                <FieldLabel htmlFor="exam-divisor" label="Ceza böleni" required hint="Net hesabında kaç yanlışın bir doğruyu götürdüğünü belirtir. Hesaplama backend sözleşmesinde yapılır." />
                                <input id="exam-divisor" className="form-control admin-field-compact" type="number" min={1} value={f.divisor} onChange={set("divisor")} required />
                            </div>
                            <div className="admin-publish-control">
                                <div>
                                    <strong>Takvim durumu</strong>
                                    <span>Aktif sınav seçimlerinde gösterilir.</span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <StatusBadge tone={f.isCurrent ? "success" : "neutral"}>{f.isCurrent ? "Güncel" : "Arşiv"}</StatusBadge>
                                    <div className="form-check form-switch mb-0">
                                        <input className="form-check-input" type="checkbox" role="switch" id="isCurrent" checked={f.isCurrent} onChange={(event) => setF((previous) => ({ ...previous, isCurrent: event.target.checked }))} />
                                    </div>
                                </div>
                            </div>
                        </FormSection>
                    </div>
                </div>
            </div>
        </form>
    );
}

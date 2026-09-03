"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle } from "react-icons/fi";
import Swal from "sweetalert2";
import { FieldLabel } from "@/components/shared/admin/FieldLabel";
import { FormSection } from "@/components/shared/admin/FormSection";
import apiClient from "@/lib/apiClient";
import type { AdminPromotion, PromotionDiscountType, PromotionRuleType } from "@/lib/types";

function errorMessage(err: unknown): string {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "İşlem tamamlanamadı."
    );
}

/** `datetime-local` expects local time while the API uses ISO/UTC. */
function toLocalInput(iso: string | null): string {
    if (!iso) return "";
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours(),
    )}:${pad(date.getMinutes())}`;
}

const RULE_OPTIONS: { value: PromotionRuleType; label: string; hint: string }[] = [
    { value: "ANYONE", label: "Herkes", hint: "Koşulsuz kampanya veya açık kupon." },
    {
        value: "NEW_USER",
        label: "Yeni kayıt",
        hint: "Son belirlenen gün içinde kaydolmuş ve hiç abone olmamış kullanıcılar.",
    },
    {
        value: "ACTIVE_DAYS",
        label: "Aktif gün",
        hint: "Belirlenen dönemde yeterli sayıda seans veya görev tamamlayan kullanıcılar.",
    },
    {
        value: "WIN_BACK",
        label: "Geri kazanım",
        hint: "Aboneliği sona ermiş veya iptal edilmiş kullanıcılar.",
    },
];

interface FormState {
    name: string;
    labelTr: string;
    labelEn: string;
    eyebrowTr: string;
    eyebrowEn: string;
    descriptionTr: string;
    descriptionEn: string;
    code: string;
    ruleType: PromotionRuleType;
    withinDays: string;
    days: string;
    windowDays: string;
    discountType: PromotionDiscountType;
    discountValue: string;
    appliesToPeriods: string;
    planIds: string;
    startsAt: string;
    endsAt: string;
    maxRedemptions: string;
    maxRedemptionsPerUser: string;
    isActive: boolean;
}

function blankToNull(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

function seed(initial?: AdminPromotion | null): FormState {
    const params = (initial?.ruleParams ?? {}) as Record<string, number | undefined>;
    return {
        name: initial?.name ?? "",
        labelTr: initial?.labelTr ?? "",
        labelEn: initial?.labelEn ?? "",
        eyebrowTr: initial?.eyebrowTr ?? "",
        eyebrowEn: initial?.eyebrowEn ?? "",
        descriptionTr: initial?.descriptionTr ?? "",
        descriptionEn: initial?.descriptionEn ?? "",
        code: initial?.code ?? "",
        ruleType: initial?.ruleType ?? "ANYONE",
        withinDays: String(params.withinDays ?? 7),
        days: String(params.days ?? 5),
        windowDays: String(params.windowDays ?? 7),
        discountType: initial?.discountType ?? "PERCENT",
        discountValue:
            initial?.discountType === "FIXED"
                ? String((initial?.discountValue ?? 0) / 100)
                : String(initial?.discountValue ?? 20),
        appliesToPeriods: String(initial?.appliesToPeriods ?? 1),
        planIds: initial?.planIds?.join(", ") ?? "",
        startsAt: toLocalInput(initial?.startsAt ?? null),
        endsAt: toLocalInput(initial?.endsAt ?? null),
        maxRedemptions: initial?.maxRedemptions === null ? "" : String(initial?.maxRedemptions ?? ""),
        maxRedemptionsPerUser: String(initial?.maxRedemptionsPerUser ?? 1),
        isActive: initial?.isActive ?? true,
    };
}

export default function PromotionForm({ initial }: { initial?: AdminPromotion | null }) {
    const router = useRouter();
    const editing = Boolean(initial);
    const [form, setForm] = useState<FormState>(() => seed(initial));
    const [busy, setBusy] = useState(false);

    const set =
        (key: keyof FormState) =>
        (event: { target: { value: string } }) =>
            setForm((current) => ({ ...current, [key]: event.target.value }));

    function ruleParams(): Record<string, number> {
        if (form.ruleType === "NEW_USER") return { withinDays: Number(form.withinDays) };
        if (form.ruleType === "ACTIVE_DAYS") {
            return { days: Number(form.days), windowDays: Number(form.windowDays) };
        }
        return {};
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        const payload = {
            name: form.name.trim(),
            labelTr: form.labelTr.trim(),
            labelEn: form.labelEn.trim(),
            eyebrowTr: blankToNull(form.eyebrowTr),
            eyebrowEn: blankToNull(form.eyebrowEn),
            descriptionTr: blankToNull(form.descriptionTr),
            descriptionEn: blankToNull(form.descriptionEn),
            code: form.code.trim() === "" ? null : form.code.trim().toUpperCase(),
            ruleType: form.ruleType,
            ruleParams: ruleParams(),
            discountType: form.discountType,
            discountValue:
                form.discountType === "FIXED"
                    ? Math.round(Number(form.discountValue) * 100)
                    : Number(form.discountValue),
            appliesToPeriods: Number(form.appliesToPeriods),
            planIds:
                form.planIds.trim() === ""
                    ? null
                    : form.planIds
                          .split(",")
                          .map((id) => id.trim())
                          .filter(Boolean),
            startsAt: form.startsAt === "" ? null : new Date(form.startsAt).toISOString(),
            endsAt: form.endsAt === "" ? null : new Date(form.endsAt).toISOString(),
            maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
            maxRedemptionsPerUser: Number(form.maxRedemptionsPerUser),
            isActive: form.isActive,
        };

        try {
            if (editing && initial) {
                await apiClient.patch(`/admin/promotions/${initial.id}`, payload);
            } else {
                await apiClient.post("/admin/promotions", payload);
            }
            await Swal.fire({
                icon: "success",
                title: editing ? "Kampanya güncellendi" : "Kampanya oluşturuldu",
                timer: 1200,
                showConfirmButton: false,
            });
            router.push("/promotions");
        } catch (error) {
            await Swal.fire({
                icon: "error",
                title: "Kampanya kaydedilemedi",
                text: errorMessage(error),
            });
        } finally {
            setBusy(false);
        }
    }

    const activeRule = RULE_OPTIONS.find((option) => option.value === form.ruleType);

    return (
        <div className="main-content">
            <form onSubmit={(event) => void submit(event)} aria-busy={busy}>
                <div className="row g-4">
                    <div className="col-xl-8">
                        <FormSection
                            title="Tanım"
                            hint="Üst etiket ve açıklama boşsa uygulamanın varsayılan metni kullanılır. Plan satırı ve buton metni kampanyadan otomatik türetilir."
                        >
                            <div className="mb-4">
                                <FieldLabel htmlFor="promotion-name" label="Kampanya adı" required hint="Yalnız admin kullanıcıları görür." />
                                <input id="promotion-name" className="form-control" value={form.name} onChange={set("name")} maxLength={80} required />
                            </div>

                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <FieldLabel htmlFor="promotion-label-tr" label="Kullanıcı rozeti (TR)" required />
                                    <input id="promotion-label-tr" className="form-control" value={form.labelTr} onChange={set("labelTr")} maxLength={60} placeholder="Hoş geldin hediyesi" required />
                                </div>
                                <div className="col-md-6 mb-3">
                                    <FieldLabel htmlFor="promotion-label-en" label="Kullanıcı rozeti (EN)" required />
                                    <input id="promotion-label-en" className="form-control" value={form.labelEn} onChange={set("labelEn")} maxLength={60} placeholder="Welcome gift" required />
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <FieldLabel htmlFor="promotion-eyebrow-tr" label="Modal üst etiketi (TR)" />
                                    <input id="promotion-eyebrow-tr" className="form-control" value={form.eyebrowTr} onChange={set("eyebrowTr")} maxLength={40} placeholder="Sana özel" />
                                </div>
                                <div className="col-md-6 mb-3">
                                    <FieldLabel htmlFor="promotion-eyebrow-en" label="Modal üst etiketi (EN)" />
                                    <input id="promotion-eyebrow-en" className="form-control" value={form.eyebrowEn} onChange={set("eyebrowEn")} maxLength={40} placeholder="Just for you" />
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <FieldLabel htmlFor="promotion-description-tr" label="Modal açıklaması (TR)" />
                                    <textarea id="promotion-description-tr" className="form-control" rows={3} value={form.descriptionTr} onChange={set("descriptionTr")} maxLength={200} placeholder="Kampanyayı anlatan kısa bir açıklama." />
                                </div>
                                <div className="col-md-6 mb-3">
                                    <FieldLabel htmlFor="promotion-description-en" label="Modal açıklaması (EN)" />
                                    <textarea id="promotion-description-en" className="form-control" rows={3} value={form.descriptionEn} onChange={set("descriptionEn")} maxLength={200} placeholder="A short description of the campaign." />
                                </div>
                            </div>

                            <div>
                                <FieldLabel htmlFor="promotion-code" label="Kupon kodu" hint="Harf, rakam ve tire kullanabilirsin. Kod kaydedilirken büyük harfe çevrilir." />
                                <input id="promotion-code" className="form-control text-uppercase" value={form.code} onChange={set("code")} maxLength={32} placeholder="HOSGELDIN" pattern="[A-Za-z0-9-]*" />
                                <div className="form-text">Boş bırakırsan indirim uygun kullanıcılara otomatik uygulanır. Kod girersen kullanıcı ödeme ekranında kodu kendisi yazar.</div>
                            </div>
                        </FormSection>

                        <FormSection title="Hedef kitle">
                            <div className="mb-3">
                                <FieldLabel htmlFor="promotion-rule" label="Uygunluk kuralı" required />
                                <select id="promotion-rule" className="form-select" value={form.ruleType} onChange={set("ruleType")}>
                                    {RULE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                <div className="form-text">{activeRule?.hint}</div>
                            </div>

                            {form.ruleType === "NEW_USER" ? (
                                <div className="admin-field-compact">
                                    <FieldLabel htmlFor="promotion-within-days" label="Kayıttan sonra kaç gün" required />
                                    <input id="promotion-within-days" type="number" className="form-control" value={form.withinDays} onChange={set("withinDays")} min={1} max={365} required />
                                </div>
                            ) : null}

                            {form.ruleType === "ACTIVE_DAYS" ? (
                                <div className="row">
                                    <div className="col-md-6 mb-3 mb-md-0">
                                        <FieldLabel htmlFor="promotion-active-days" label="En az aktif gün" required />
                                        <input id="promotion-active-days" type="number" className="form-control" value={form.days} onChange={set("days")} min={1} max={31} required />
                                    </div>
                                    <div className="col-md-6">
                                        <FieldLabel htmlFor="promotion-window-days" label="Değerlendirme aralığı (gün)" required />
                                        <input id="promotion-window-days" type="number" className="form-control" value={form.windowDays} onChange={set("windowDays")} min={1} max={90} required />
                                    </div>
                                </div>
                            ) : null}
                        </FormSection>
                    </div>

                    <div className="col-xl-4">
                        <div className="admin-form-rail">
                            <FormSection title="İndirim ve planlar">
                                <div className="mb-3">
                                    <FieldLabel htmlFor="promotion-discount-type" label="İndirim türü" required />
                                    <select id="promotion-discount-type" className="form-select" value={form.discountType} onChange={set("discountType")}>
                                        <option value="PERCENT">Yüzde (%)</option>
                                        <option value="FIXED">Sabit tutar (₺)</option>
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <FieldLabel
                                        htmlFor="promotion-discount-value"
                                        label={form.discountType === "PERCENT" ? "İndirim yüzdesi" : "İndirim tutarı (₺)"}
                                        required
                                        hint="Ayarlar bölümündeki promotions.max_percent değeri her iki indirim türünün üst sınırını belirler."
                                    />
                                    <input id="promotion-discount-value" type="number" className="form-control" value={form.discountValue} onChange={set("discountValue")} min={form.discountType === "PERCENT" ? 1 : 0.01} max={form.discountType === "PERCENT" ? 90 : undefined} step={form.discountType === "PERCENT" ? 1 : 0.01} required />
                                </div>

                                <div className="mb-3">
                                    <FieldLabel htmlFor="promotion-periods" label="Uygulanacak tahsilat" required hint="Üst sınırı promotions.max_discount_periods ayarı belirler." />
                                    <input id="promotion-periods" type="number" className="form-control" value={form.appliesToPeriods} onChange={set("appliesToPeriods")} min={1} max={24} required />
                                    <div className="form-text">Ödeme sağlayıcısı çok dönemli indirimi destekleyene kadar bu değer 1 kalmalı.</div>
                                </div>

                                <div>
                                    <FieldLabel htmlFor="promotion-plans" label="Planlar" hint="Birden fazla plan kimliğini virgülle ayır." />
                                    <input id="promotion-plans" className="form-control" value={form.planIds} onChange={set("planIds")} placeholder="premium-monthly, premium-3m" />
                                    <div className="form-text">Boş bırakırsan tüm planlarda geçerli olur.</div>
                                </div>
                            </FormSection>

                            <FormSection title="Geçerlilik ve limitler">
                                <div className="row">
                                    <div className="col-sm-6 col-xl-12 mb-3">
                                        <FieldLabel htmlFor="promotion-start" label="Başlangıç" />
                                        <input id="promotion-start" type="datetime-local" className="form-control" value={form.startsAt} onChange={set("startsAt")} />
                                    </div>
                                    <div className="col-sm-6 col-xl-12 mb-3">
                                        <FieldLabel htmlFor="promotion-end" label="Bitiş" />
                                        <input id="promotion-end" type="datetime-local" className="form-control" value={form.endsAt} onChange={set("endsAt")} />
                                    </div>
                                    <div className="col-sm-6 col-xl-12 mb-3">
                                        <FieldLabel htmlFor="promotion-total-limit" label="Toplam kullanım limiti" hint="Boş bırakırsan toplam kullanım sınırı uygulanmaz." />
                                        <input id="promotion-total-limit" type="number" className="form-control" value={form.maxRedemptions} onChange={set("maxRedemptions")} min={1} placeholder="Sınırsız" />
                                    </div>
                                    <div className="col-sm-6 col-xl-12">
                                        <FieldLabel htmlFor="promotion-user-limit" label="Kullanıcı başına limit" required />
                                        <input id="promotion-user-limit" type="number" className="form-control" value={form.maxRedemptionsPerUser} onChange={set("maxRedemptionsPerUser")} min={1} max={100} required />
                                    </div>
                                </div>
                            </FormSection>

                            <FormSection title="Yayın durumu">
                                <div className="admin-publish-control">
                                    <div>
                                        <strong>{form.isActive ? "Yayında" : "Durduruldu"}</strong>
                                        <span>{form.isActive ? "Koşulları sağlayan ödemelerde uygulanabilir." : "Hiçbir yeni ödemede uygulanmaz."}</span>
                                    </div>
                                    <div className="form-check form-switch m-0">
                                        <input
                                            id="promotion-active"
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={form.isActive}
                                            onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                                            aria-label="Kampanyayı yayında tut"
                                        />
                                    </div>
                                </div>
                            </FormSection>

                            <button type="submit" className="btn btn-primary w-100 admin-submit-button" disabled={busy}>
                                <FiCheckCircle aria-hidden="true" />
                                <span>{busy ? "Kaydediliyor…" : editing ? "Kampanyayı güncelle" : "Kampanyayı oluştur"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}

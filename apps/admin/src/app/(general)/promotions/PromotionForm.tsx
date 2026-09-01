"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import apiClient from "@/lib/apiClient";
import type { AdminPromotion, PromotionDiscountType, PromotionRuleType } from "@/lib/types";

function errorMessage(err: unknown): string {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "İşlem tamamlanamadı."
    );
}

/** `datetime-local` wants `yyyy-MM-ddTHH:mm` in local time; the API speaks ISO/UTC. */
function toLocalInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours(),
    )}:${pad(d.getMinutes())}`;
}

const RULE_OPTIONS: { value: PromotionRuleType; label: string; hint: string }[] = [
    { value: "ANYONE", label: "Herkes", hint: "Koşulsuz — dönemsel kampanya veya açık kupon." },
    {
        value: "NEW_USER",
        label: "Yeni kayıt",
        hint: "Son N gün içinde kaydolmuş ve hiç abone olmamış kullanıcı.",
    },
    {
        value: "ACTIVE_DAYS",
        label: "Aktif gün",
        hint: "Son N gün içinde en az X gün çalışmış kullanıcı (seans veya görev).",
    },
    {
        value: "WIN_BACK",
        label: "Geri kazanım",
        hint: "Aboneliği sona ermiş ya da iptal etmiş kullanıcı.",
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
            // Blank clears the column: the app then falls back to its own default wording.
            eyebrowTr: blankToNull(form.eyebrowTr),
            eyebrowEn: blankToNull(form.eyebrowEn),
            descriptionTr: blankToNull(form.descriptionTr),
            descriptionEn: blankToNull(form.descriptionEn),
            code: form.code.trim() === "" ? null : form.code.trim().toUpperCase(),
            ruleType: form.ruleType,
            ruleParams: ruleParams(),
            discountType: form.discountType,
            // FIXED is entered in lira but stored in kuruş — money is integer minor units.
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
            Swal.fire({
                icon: "success",
                title: "Kaydedildi",
                timer: 1200,
                showConfirmButton: false,
            });
            router.push("/promotions");
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errorMessage(err) });
        } finally {
            setBusy(false);
        }
    }

    const activeRule = RULE_OPTIONS.find((option) => option.value === form.ruleType);

    return (
        <div className="nxl-content">
            <form onSubmit={(event) => void submit(event)}>
                <div className="row">
                    <div className="col-lg-8">
                        <div className="card stretch stretch-full mb-4">
                            <div className="card-body">
                                <h6 className="fw-bold mb-3">Tanım</h6>

                                <div className="mb-3">
                                    <label className="form-label">Ad (yalnız admin görür)</label>
                                    <input
                                        className="form-control"
                                        value={form.name}
                                        onChange={set("name")}
                                        maxLength={80}
                                        required
                                    />
                                </div>

                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Kullanıcı rozeti (TR)</label>
                                        <input
                                            className="form-control"
                                            value={form.labelTr}
                                            onChange={set("labelTr")}
                                            maxLength={60}
                                            placeholder="Hoş geldin hediyesi"
                                            required
                                        />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Kullanıcı rozeti (EN)</label>
                                        <input
                                            className="form-control"
                                            value={form.labelEn}
                                            onChange={set("labelEn")}
                                            maxLength={60}
                                            placeholder="Welcome gift"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Modal üst etiketi (TR)</label>
                                        <input
                                            className="form-control"
                                            value={form.eyebrowTr}
                                            onChange={set("eyebrowTr")}
                                            maxLength={40}
                                            placeholder="Sana özel"
                                        />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Modal üst etiketi (EN)</label>
                                        <input
                                            className="form-control"
                                            value={form.eyebrowEn}
                                            onChange={set("eyebrowEn")}
                                            maxLength={40}
                                            placeholder="Just for you"
                                        />
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Modal açıklaması (TR)</label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            value={form.descriptionTr}
                                            onChange={set("descriptionTr")}
                                            maxLength={200}
                                            placeholder="Kampanyayı anlatan bir iki cümle."
                                        />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Modal açıklaması (EN)</label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            value={form.descriptionEn}
                                            onChange={set("descriptionEn")}
                                            maxLength={200}
                                            placeholder="A sentence or two about the campaign."
                                        />
                                    </div>
                                </div>

                                <p className="text-muted small mb-3">
                                    Üst etiket ve açıklama boş bırakılırsa uygulama kendi
                                    varsayılan metnini kullanır. İndirimin hangi planlarda geçerli
                                    olduğunu anlatan satır ile buton yazısı kampanyadan türetilir,
                                    elle yazılamaz.
                                </p>

                                <div className="mb-1">
                                    <label className="form-label">Kupon kodu</label>
                                    <input
                                        className="form-control text-uppercase"
                                        value={form.code}
                                        onChange={set("code")}
                                        maxLength={32}
                                        placeholder="HOSGELDIN"
                                        pattern="[A-Za-z0-9-]*"
                                    />
                                    <div className="fs-12 text-muted mt-1">
                                        Boş bırakırsan indirim uygun kullanıcılara{" "}
                                        <strong>otomatik</strong> uygulanır. Kod yazarsan kullanıcı
                                        ödeme ekranında kendisi girer.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card stretch stretch-full mb-4">
                            <div className="card-body">
                                <h6 className="fw-bold mb-3">Kimler yararlanır</h6>

                                <div className="mb-3">
                                    <label className="form-label">Kural</label>
                                    <select
                                        className="form-select"
                                        value={form.ruleType}
                                        onChange={set("ruleType")}
                                    >
                                        {RULE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="fs-12 text-muted mt-1">{activeRule?.hint}</div>
                                </div>

                                {form.ruleType === "NEW_USER" ? (
                                    <div className="mb-0" style={{ maxWidth: 240 }}>
                                        <label className="form-label">Kayıttan sonra kaç gün</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={form.withinDays}
                                            onChange={set("withinDays")}
                                            min={1}
                                            max={365}
                                            required
                                        />
                                    </div>
                                ) : null}

                                {form.ruleType === "ACTIVE_DAYS" ? (
                                    <div className="row">
                                        <div className="col-md-6 mb-0">
                                            <label className="form-label">En az kaç aktif gün</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={form.days}
                                                onChange={set("days")}
                                                min={1}
                                                max={31}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-6 mb-0">
                                            <label className="form-label">Kaç günlük pencerede</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={form.windowDays}
                                                onChange={set("windowDays")}
                                                min={1}
                                                max={90}
                                                required
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-4">
                        <div className="card stretch stretch-full mb-4">
                            <div className="card-body">
                                <h6 className="fw-bold mb-3">İndirim</h6>

                                <div className="mb-3">
                                    <label className="form-label">Tür</label>
                                    <select
                                        className="form-select"
                                        value={form.discountType}
                                        onChange={set("discountType")}
                                    >
                                        <option value="PERCENT">Yüzde (%)</option>
                                        <option value="FIXED">Sabit tutar (₺)</option>
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">
                                        {form.discountType === "PERCENT" ? "Yüzde" : "Tutar (₺)"}
                                    </label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={form.discountValue}
                                        onChange={set("discountValue")}
                                        min={form.discountType === "PERCENT" ? 1 : 0.01}
                                        max={form.discountType === "PERCENT" ? 90 : undefined}
                                        step={form.discountType === "PERCENT" ? 1 : 0.01}
                                        required
                                    />
                                    <div className="fs-12 text-muted mt-1">
                                        Ayarlar&apos;daki <code>promotions.max_percent</code> tavanı
                                        her iki türü de sınırlar.
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">Kaç tahsilata uygulanır</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={form.appliesToPeriods}
                                        onChange={set("appliesToPeriods")}
                                        min={1}
                                        max={24}
                                        required
                                    />
                                    <div className="fs-12 text-muted mt-1">
                                        1 = yalnız ilk tahsilat. Üst sınırı{" "}
                                        <code>promotions.max_discount_periods</code> belirler;
                                        ödeme sağlayıcısı çok dönemli indirimi destekleyene kadar 1
                                        kalmalı.
                                    </div>
                                </div>

                                <div className="mb-0">
                                    <label className="form-label">Planlar</label>
                                    <input
                                        className="form-control"
                                        value={form.planIds}
                                        onChange={set("planIds")}
                                        placeholder="premium-monthly, premium-3m"
                                    />
                                    <div className="fs-12 text-muted mt-1">
                                        Boş = tüm planlar.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card stretch stretch-full mb-4">
                            <div className="card-body">
                                <h6 className="fw-bold mb-3">Sınırlar</h6>

                                <div className="mb-3">
                                    <label className="form-label">Başlangıç</label>
                                    <input
                                        type="datetime-local"
                                        className="form-control"
                                        value={form.startsAt}
                                        onChange={set("startsAt")}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Bitiş</label>
                                    <input
                                        type="datetime-local"
                                        className="form-control"
                                        value={form.endsAt}
                                        onChange={set("endsAt")}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Toplam kullanım limiti</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={form.maxRedemptions}
                                        onChange={set("maxRedemptions")}
                                        min={1}
                                        placeholder="Sınırsız"
                                    />
                                </div>
                                <div className="mb-0">
                                    <label className="form-label">Kullanıcı başına limit</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={form.maxRedemptionsPerUser}
                                        onChange={set("maxRedemptionsPerUser")}
                                        min={1}
                                        max={100}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="card stretch stretch-full mb-4">
                            <div className="card-body">
                                <label className="form-check form-switch mb-0">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={form.isActive}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                isActive: event.target.checked,
                                            }))
                                        }
                                    />
                                    <span className="form-check-label ms-2">Yayında</span>
                                </label>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                            {busy ? "Kaydediliyor…" : editing ? "Güncelle" : "Oluştur"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

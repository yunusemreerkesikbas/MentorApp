'use client'
import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { FormSection } from "@/components/shared/admin/FormSection";
import { InfoHint } from "@/components/shared/admin/InfoHint";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { ConfigEntry } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
    "feature-flags": "Özellik bayrakları",
    economy: "Ekonomi",
    ai: "Yapay zekâ",
    coaching: "Koçluk",
    identity: "Hesap ve kimlik",
    notifications: "Bildirimler",
    forum: "Topluluk",
    ads: "Reklamlar",
    promotions: "Kampanyalar",
    mentorship: "Mentorluk",
};

const categoryLabel = (category: string) => CATEGORY_LABELS[category] ?? category.replaceAll("-", " ");

// Admin config registry + feature flags (W6, §9). Boolean keys render as toggles; other types as
// inputs. Every save is audited server-side; sensitive keys confirm before applying.
export default function ConfigPage() {
    const [entries, setEntries] = useState<ConfigEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setHasError(false);
        try {
            const { data } = await apiClient.get<ConfigEntry[]>("/admin/config");
            setEntries(data);
        } catch {
            setEntries([]);
            setHasError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async (entry: ConfigEntry, value: unknown) => {
        if (entry.sensitive) {
            const ok = await Swal.fire({
                title: "Hassas ayar",
                text: `${entry.key} değiştirilsin mi?`,
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Evet",
                cancelButtonText: "Vazgeç",
            });
            if (!ok.isConfirmed) return;
        }
        setBusyKey(entry.key);
        try {
            const { data } = await apiClient.patch<ConfigEntry[]>(
                `/admin/config/${entry.key}`,
                { value },
            );
            setEntries(data);
            Swal.fire({ icon: "success", title: "Kaydedildi", timer: 1000, showConfirmButton: false });
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Kaydedilemedi.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
            await load(); // revert optimistic UI to server truth
        } finally {
            setBusyKey(null);
        }
    };

    const categories = [...new Set(entries.map((e) => e.category))];

    return (
        <>
            <AdminPageHeader
                title="Ayarlar"
                breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Ayarlar" }]}
            />
            <div className="main-content">
                {loading ? (
                    <div className="card"><AsyncState status="loading" title="Ayarlar yükleniyor" /></div>
                ) : hasError ? (
                    <div className="card"><AsyncState status="error" title="Ayarlar yüklenemedi" description="Yapılandırma kayıtları alınamadı. Bağlantıyı kontrol edip yeniden deneyin." onRetry={() => void load()} /></div>
                ) : categories.length === 0 ? (
                    <div className="card"><AsyncState status="empty" title="Ayar bulunamadı" description="Düzenlenebilir bir yapılandırma kaydı bulunmuyor." /></div>
                ) : categories.map((category) => (
                    <FormSection title={categoryLabel(category)} key={category}>
                        <div className="admin-config-list">
                            {entries.filter((entry) => entry.category === category).map((entry) => (
                                <ConfigRow
                                    key={entry.key}
                                    entry={entry}
                                    busy={busyKey === entry.key}
                                    onSave={(value) => save(entry, value)}
                                />
                            ))}
                        </div>
                    </FormSection>
                ))}
            </div>
        </>
    );
}

function ConfigRow({ entry, busy, onSave }: { entry: ConfigEntry; busy: boolean; onSave: (value: unknown) => Promise<void> }) {
    const inputId = `config-${entry.key}`;

    return (
        <div className="admin-config-row">
            <div className="admin-config-copy">
                <div className="d-flex align-items-center flex-wrap gap-2">
                    <label className="fw-semibold mb-0" htmlFor={inputId}>{entry.key}</label>
                    <InfoHint label={`${entry.key} ayarı hakkında bilgi`} content={entry.description} placement="right" />
                    {entry.sensitive ? <StatusBadge tone="warning">Hassas ayar</StatusBadge> : null}
                </div>
            </div>
            <div className="admin-config-control">
                {entry.type === "boolean" ? (
                    <div className="d-flex align-items-center justify-content-end gap-3">
                        <StatusBadge tone={entry.value === true ? "success" : "neutral"}>
                            {entry.value === true ? "Açık" : "Kapalı"}
                        </StatusBadge>
                        <div className="form-check form-switch mb-0">
                            <input
                                id={inputId}
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                checked={entry.value === true}
                                disabled={busy}
                                aria-busy={busy}
                                onChange={(event) => void onSave(event.target.checked)}
                            />
                        </div>
                    </div>
                ) : (
                    <BoundInput inputId={inputId} entry={entry} disabled={busy} onSave={onSave} />
                )}
            </div>
        </div>
    );
}

// Inline editor for non-boolean keys (number/string). Coerces numbers before saving.
function BoundInput({ inputId, entry, disabled, onSave }: { inputId: string; entry: ConfigEntry; disabled: boolean; onSave: (value: unknown) => Promise<void> }) {
    const [draft, setDraft] = useState(String(entry.value ?? ""));

    useEffect(() => {
        setDraft(String(entry.value ?? ""));
    }, [entry.value]);

    return (
        <div className="admin-config-input-group">
            <input
                id={inputId}
                className="form-control form-control-sm"
                type={entry.type === "number" ? "number" : "text"}
                value={draft}
                disabled={disabled}
                onChange={(e) => setDraft(e.target.value)}
            />
            <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={disabled}
                aria-busy={disabled}
                onClick={() => void onSave(entry.type === "number" ? Number(draft) : draft)}
            >
                {disabled ? "Kaydediliyor…" : "Kaydet"}
            </button>
        </div>
    );
}

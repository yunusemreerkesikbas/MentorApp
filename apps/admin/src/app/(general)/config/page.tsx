'use client'
import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { ConfigEntry } from "@/lib/types";

// Admin config registry + feature flags (W6, §9). Boolean keys render as toggles; other types as
// inputs. Every save is audited server-side; sensitive keys confirm before applying.
export default function ConfigPage() {
    const [entries, setEntries] = useState<ConfigEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<ConfigEntry[]>("/admin/config");
            setEntries(data);
        } catch {
            setEntries([]);
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
            <PageHeader>{null}</PageHeader>
            <div className="main-content">
                {loading && <div className="text-center py-5">Yükleniyor…</div>}
                {!loading && categories.map((cat) => (
                    <div className="card stretch stretch-full mb-4" key={cat}>
                        <div className="card-header"><h5 className="mb-0 text-capitalize">{cat.replace("-", " ")}</h5></div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <tbody>
                                        {entries.filter((e) => e.category === cat).map((e) => (
                                            <tr key={e.key}>
                                                <td style={{ width: "55%" }}>
                                                    <div className="fw-semibold">{e.key}</div>
                                                    <div className="fs-12 text-muted">{e.description}</div>
                                                </td>
                                                <td className="text-end">
                                                    {e.type === "boolean" ? (
                                                        <div className="form-check form-switch d-inline-block">
                                                            <input
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                role="switch"
                                                                checked={e.value === true}
                                                                disabled={busyKey === e.key}
                                                                onChange={(ev) => save(e, ev.target.checked)}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <BoundInput entry={e} disabled={busyKey === e.key} onSave={(v) => save(e, v)} />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

// Inline editor for non-boolean keys (number/string). Coerces numbers before saving.
function BoundInput({ entry, disabled, onSave }: { entry: ConfigEntry; disabled: boolean; onSave: (v: unknown) => void }) {
    const [draft, setDraft] = useState(String(entry.value ?? ""));
    return (
        <div className="d-inline-flex gap-2">
            <input
                className="form-control form-control-sm"
                style={{ maxWidth: 200 }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
            />
            <button
                className="btn btn-sm btn-primary"
                disabled={disabled}
                onClick={() => onSave(entry.type === "number" ? Number(draft) : draft)}
            >
                Kaydet
            </button>
        </div>
    );
}

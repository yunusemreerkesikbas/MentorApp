'use client'
import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import type { AdminPlan } from "@/lib/types";

function formatPrice(minor: number): string {
    return (minor / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

export default function PlansPage() {
    const [plans, setPlans] = useState<AdminPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<AdminPlan[]>("/admin/plans");
            setPlans(data);
        } catch {
            setPlans([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async (plan: AdminPlan) => {
        setBusyId(plan.id);
        try {
            const { data } = await apiClient.patch<AdminPlan>(`/admin/plans/${plan.id}`, {
                name: plan.name,
                priceMinor: plan.priceMinor,
                trialDays: plan.trialDays,
                isActive: plan.isActive,
            });
            setPlans((current) => current.map((row) => (row.id === data.id ? data : row)));
            Swal.fire({ icon: "success", title: "Kaydedildi", timer: 1000, showConfirmButton: false });
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Kaydedilemedi.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
            await load();
        } finally {
            setBusyId(null);
        }
    };

    return (
        <>
            <PageHeader>{null}</PageHeader>
            <div className="main-content">
                {loading && <div className="text-center py-5">Yükleniyor…</div>}
                {!loading && (
                    <div className="card stretch stretch-full">
                        <div className="card-header">
                            <h5 className="mb-0">Planlar</h5>
                            <p className="mb-0 fs-12 text-muted">
                                Fiyat yalnızca yeni checkout’lara uygulanır. Dönem uzunluğu kilitlidir.
                            </p>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th>Kimlik</th>
                                            <th>Ad</th>
                                            <th>Fiyat (kuruş)</th>
                                            <th>Deneme (gün)</th>
                                            <th>Dönem</th>
                                            <th>Aktif</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {plans.map((plan) => (
                                            <tr key={plan.id}>
                                                <td className="font-monospace fs-12">{plan.id}</td>
                                                <td>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        value={plan.name}
                                                        disabled={busyId === plan.id}
                                                        onChange={(event) =>
                                                            setPlans((current) =>
                                                                current.map((row) =>
                                                                    row.id === plan.id
                                                                        ? { ...row, name: event.target.value }
                                                                        : row,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        type="number"
                                                        min={1}
                                                        value={plan.priceMinor}
                                                        disabled={busyId === plan.id}
                                                        onChange={(event) =>
                                                            setPlans((current) =>
                                                                current.map((row) =>
                                                                    row.id === plan.id
                                                                        ? {
                                                                              ...row,
                                                                              priceMinor: Number(event.target.value),
                                                                          }
                                                                        : row,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                    <div className="fs-12 text-muted">{formatPrice(plan.priceMinor)}</div>
                                                </td>
                                                <td>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        type="number"
                                                        min={0}
                                                        value={plan.trialDays}
                                                        disabled={busyId === plan.id}
                                                        onChange={(event) =>
                                                            setPlans((current) =>
                                                                current.map((row) =>
                                                                    row.id === plan.id
                                                                        ? {
                                                                              ...row,
                                                                              trialDays: Number(event.target.value),
                                                                          }
                                                                        : row,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>{plan.periodMonths} ay</td>
                                                <td>
                                                    <div className="form-check form-switch">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            checked={plan.isActive}
                                                            disabled={busyId === plan.id}
                                                            onChange={(event) =>
                                                                setPlans((current) =>
                                                                    current.map((row) =>
                                                                        row.id === plan.id
                                                                            ? { ...row, isActive: event.target.checked }
                                                                            : row,
                                                                    ),
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-primary"
                                                        disabled={busyId === plan.id}
                                                        onClick={() => void save(plan)}
                                                    >
                                                        Kaydet
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

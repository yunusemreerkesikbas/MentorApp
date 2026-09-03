'use client'
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { FormSection } from "@/components/shared/admin/FormSection";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { ASSIGNABLE_ROLES, isFullAccess } from "@/lib/roles";
import type { AdminUserDetail, AdminEconomyOverview, AdminSubscriptionView } from "@/lib/types";

type Status = "ACTIVE" | "SUSPENDED" | "BANNED";

const fmtTry = (minor: number) => `${(minor / 100).toFixed(2)} ₺`;

const subscriptionStatusLabel = (status: string) => ({
    TRIALING: "Deneme",
    ACTIVE: "Aktif",
    PAST_DUE: "Ödeme bekliyor",
    CANCELED: "İptal edildi",
    EXPIRED: "Süresi doldu",
}[status] ?? status);

const transactionStatusLabel = (status: string) => ({
    SUCCEEDED: "Başarılı",
    FAILED: "Başarısız",
    REFUNDED: "İade edildi",
}[status] ?? status);

// Admin user detail (W6): identity fields + graduated status (suspend/ban/reactivate) + KVKK
// export/anonymize. All mutations audited server-side; admins can't act on their own account.
export default function UserDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const [user, setUser] = useState<AdminUserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const { data } = await apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
            setUser(data);
        } catch {
            setUser(null);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // ---- economy (W6) ----
    const [econ, setEcon] = useState<AdminEconomyOverview | null>(null);
    const [econLoading, setEconLoading] = useState(true);
    const [econError, setEconError] = useState(false);
    const [adjUnit, setAdjUnit] = useState<"XP" | "COIN">("COIN");
    const [adjAmount, setAdjAmount] = useState("");
    const [adjReason, setAdjReason] = useState("");

    const loadEcon = useCallback(async () => {
        setEconLoading(true);
        setEconError(false);
        try {
            const { data } = await apiClient.get<AdminEconomyOverview>(`/admin/users/${id}/economy`);
            setEcon(data);
        } catch {
            setEcon(null);
            setEconError(true);
        } finally {
            setEconLoading(false);
        }
    }, [id]);

    useEffect(() => { loadEcon(); }, [loadEcon]);

    const submitAdjust = async () => {
        const amount = Number(adjAmount);
        if (!Number.isInteger(amount) || amount === 0 || !adjReason.trim()) {
            Swal.fire({ icon: "warning", title: "Geçersiz", text: "Sıfır olmayan tam sayı ve sebep gerekli." });
            return;
        }
        const confirm = await Swal.fire({
            title: "Bakiye düzeltmesi",
            text: `${user?.email}: ${adjUnit} ${amount > 0 ? "+" : ""}${amount}`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Uygula",
            cancelButtonText: "Vazgeç",
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            await apiClient.post(`/admin/users/${id}/economy/adjust`, {
                unit: adjUnit,
                amount,
                reason: adjReason.trim(),
            });
            setAdjAmount("");
            setAdjReason("");
            await loadEcon();
            Swal.fire({ icon: "success", title: "Uygulandı", timer: 1100, showConfirmButton: false });
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "İşlem başarısız.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally {
            setBusy(false);
        }
    };

    const errMsg = (err: unknown) =>
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "İşlem başarısız.";

    // ---- subscription (W6) ----
    const [sub, setSub] = useState<AdminSubscriptionView | null>(null);
    const [subLoading, setSubLoading] = useState(true);
    const [subError, setSubError] = useState(false);
    const [refundAmount, setRefundAmount] = useState(""); // kuruş
    const [refundReason, setRefundReason] = useState("");

    const loadSub = useCallback(async () => {
        setSubLoading(true);
        setSubError(false);
        try {
            const { data } = await apiClient.get<AdminSubscriptionView>(`/admin/users/${id}/subscription`);
            setSub(data);
        } catch {
            setSub(null);
            setSubError(true);
        } finally {
            setSubLoading(false);
        }
    }, [id]);

    useEffect(() => { loadSub(); }, [loadSub]);

    const hasCharge = !!sub?.transactions.some((t) => t.type === "RENEWAL" && t.status === "SUCCEEDED");

    const submitRefund = async () => {
        const amountMinor = Number(refundAmount);
        if (!Number.isInteger(amountMinor) || amountMinor <= 0 || !refundReason.trim()) {
            Swal.fire({ icon: "warning", title: "Geçersiz", text: "Pozitif tam sayı (kuruş) ve sebep gerekli." });
            return;
        }
        const confirm = await Swal.fire({
            title: "İade",
            text: `${user?.email}: ${fmtTry(amountMinor)} iade edilsin mi?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "İade et",
            cancelButtonText: "Vazgeç",
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            await apiClient.post(`/admin/users/${id}/subscription/refund`, {
                amountMinor,
                reason: refundReason.trim(),
            });
            setRefundAmount("");
            setRefundReason("");
            await loadSub();
            Swal.fire({ icon: "success", title: "İade kaydedildi", timer: 1100, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errMsg(err) });
        } finally {
            setBusy(false);
        }
    };

    const cancelSub = async () => {
        const confirm = await Swal.fire({
            title: "Abonelik iptal edilsin mi?",
            text: `${user?.email}: yenileme durur, erişim dönem sonunda biter.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "İptal et",
            cancelButtonText: "Vazgeç",
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            await apiClient.post(`/admin/users/${id}/subscription/cancel`);
            await loadSub();
            Swal.fire({ icon: "success", title: "İptal edildi", timer: 1100, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errMsg(err) });
        } finally {
            setBusy(false);
        }
    };

    const changeStatus = async (status: Status, label: string) => {
        const confirm = await Swal.fire({
            title: `${label}?`,
            text: `${user?.email} → ${status}`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Evet",
            cancelButtonText: "Vazgeç",
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            await apiClient.patch(`/admin/users/${id}/status`, { status });
            await load();
            Swal.fire({ icon: "success", title: "Güncellendi", timer: 1100, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errMsg(err) });
        } finally {
            setBusy(false);
        }
    };

    const exportData = async () => {
        try {
            const { data } = await apiClient.get(`/admin/users/${id}/export`);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `kvkk-export-${id}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errMsg(err) });
        }
    };

    // ---- fine sub-role assignment (W6, SUPER_ADMIN; ADMIN umbrella) ----
    const { admin } = useAuth();
    const canManageRoles = isFullAccess(admin?.roles);

    const toggleRole = async (role: string) => {
        if (!user) return;
        const has = (user.roles as string[]).includes(role);
        const confirm = await Swal.fire({
            title: has ? "Rol kaldırılsın mı?" : "Rol verilsin mi?",
            text: `${user.email} → ${role}`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: has ? "Kaldır" : "Ver",
            cancelButtonText: "Vazgeç",
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            if (has) await apiClient.delete(`/admin/users/${id}/roles/${role}`);
            else await apiClient.post(`/admin/users/${id}/roles/${role}`);
            await load();
            Swal.fire({ icon: "success", title: "Güncellendi", timer: 1000, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errMsg(err) });
        } finally {
            setBusy(false);
        }
    };

    const anonymize = async () => {
        const confirm = await Swal.fire({
            title: "Anonimleştirilsin mi?",
            text: "KVKK silme: kişisel veriler temizlenir ve hesap yasaklanır. Geri alınamaz.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Evet, anonimleştir",
            cancelButtonText: "Vazgeç",
            confirmButtonColor: "#d33",
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            await apiClient.post(`/admin/users/${id}/anonymize`);
            await load();
            Swal.fire({ icon: "success", title: "Anonimleştirildi", timer: 1300, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: "error", title: "Hata", text: errMsg(err) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <AdminPageHeader title="Kullanıcı detayı" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Kullanıcılar", href: "/users" }, { label: user?.displayName ?? "Detay" }]} actions={<Link href="/users" className="btn btn-light"><FiArrowLeft aria-hidden="true" /> Kullanıcılar</Link>} />
            <div className="main-content">
                {loading && <AsyncState status="loading" title="Kullanıcı yükleniyor" />}
                {!loading && loadError && <AsyncState status="error" title="Kullanıcı yüklenemedi" description="Kayıt bulunamadı veya bağlantı kurulamadı." onRetry={() => void load()} />}
                {!loading && user && (
                    <div className="row g-4">
                        <div className="col-lg-7">
                            <FormSection title={user.displayName || "Kullanıcı bilgileri"}>
                                    <dl className="row mb-0">
                                        <dt className="col-4 text-muted fs-12">E-posta</dt><dd className="col-8">{user.email}</dd>
                                        <dt className="col-4 text-muted fs-12">Durum</dt>
                                        <dd className="col-8"><StatusBadge tone={user.status === "ACTIVE" ? "success" : user.status === "SUSPENDED" ? "warning" : user.status === "BANNED" ? "danger" : "neutral"}>{user.status === "ACTIVE" ? "Aktif" : user.status === "SUSPENDED" ? "Askıda" : user.status === "BANNED" ? "Yasaklı" : user.status}</StatusBadge></dd>
                                        <dt className="col-4 text-muted fs-12">Roller</dt>
                                        <dd className="col-8">{user.roles.map((r) => <span key={r} className="badge bg-soft-primary text-primary me-1">{r}</span>)}</dd>
                                        <dt className="col-4 text-muted fs-12">STAFF</dt><dd className="col-8">{user.isStaff ? "Evet" : "Hayır"}</dd>
                                        <dt className="col-4 text-muted fs-12">Sınav</dt><dd className="col-8">{user.examType ?? "—"} {user.examDate ? `· ${user.examDate}` : ""}</dd>
                                        <dt className="col-4 text-muted fs-12">E-posta doğrulandı</dt><dd className="col-8">{user.emailVerified ? "Evet" : "Hayır"}</dd>
                                        <dt className="col-4 text-muted fs-12">Kayıt</dt><dd className="col-8">{new Date(user.createdAt).toLocaleString("tr-TR")}</dd>
                                    </dl>
                            </FormSection>
                        </div>
                        <div className="col-lg-5">
                            <FormSection title="Durum yönetimi">
                                <div className="d-flex flex-column gap-2">
                                    {user.status !== "SUSPENDED" && (
                                        <button className="btn btn-outline-warning" disabled={busy} onClick={() => changeStatus("SUSPENDED", "Askıya al")}>Askıya al</button>
                                    )}
                                    {user.status !== "BANNED" && (
                                        <button className="btn btn-outline-danger" disabled={busy} onClick={() => changeStatus("BANNED", "Banla")}>Banla</button>
                                    )}
                                    {user.status !== "ACTIVE" && (
                                        <button className="btn btn-outline-success" disabled={busy} onClick={() => changeStatus("ACTIVE", "Yeniden aktifleştir")}>Yeniden aktifleştir</button>
                                    )}
                                </div>
                            </FormSection>
                            <FormSection title="KVKK" hint="Anonimleştirme kişisel verileri temizler, hesabı yasaklar ve geri alınamaz.">
                                <div className="d-flex flex-column gap-2">
                                    <button className="btn btn-outline-primary" onClick={exportData}>Verileri dışa aktar (JSON)</button>
                                    <button className="btn btn-danger" disabled={busy} onClick={anonymize}>Anonimleştir (silme hakkı)</button>
                                </div>
                            </FormSection>
                            {canManageRoles && (
                                <div className="card stretch stretch-full">
                                    <div className="card-header"><h6 className="mb-0">Roller</h6></div>
                                    <div className="card-body d-flex flex-column gap-2">
                                        <div className="fs-12 text-muted mb-1">Rol ver/al (SUPER_ADMIN). COACH panel erişimi vermez, yalnız koçluk yüzeyini açar. STAFF kullanıcı listesinden yönetilir.</div>
                                        {ASSIGNABLE_ROLES.map((role) => {
                                            const has = user.roles.includes(role);
                                            return (
                                                <button
                                                    key={role}
                                                    className={`btn btn-sm ${has ? "btn-outline-danger" : "btn-outline-success"}`}
                                                    disabled={busy}
                                                    onClick={() => toggleRole(role)}
                                                >
                                                    {has ? `${role} kaldır` : `${role} ver`}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="col-12">
                            <div className="card stretch stretch-full">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <h6 className="mb-0">Ekonomi</h6>
                                    {econ && (
                                        <div className="d-flex gap-3 fs-12 align-items-center">
                                            <span>XP: <strong>{econ.balance.xp}</strong></span>
                                            <span>Coin: <strong>{econ.balance.coinConfirmed}</strong>
                                                {econ.balance.coinPending ? <span className="text-muted"> (+{econ.balance.coinPending} beklemede)</span> : null}</span>
                                            <span className="text-muted">Davet: {econ.invite.converted}/{econ.invite.invited}{econ.invite.code ? ` · ${econ.invite.code}` : ""}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="card-body">
                                    {econLoading ? <AsyncState status="loading" title="Ekonomi verileri yükleniyor" size="compact" /> : null}
                                    {!econLoading && econError ? <AsyncState status="error" title="Ekonomi verileri yüklenemedi" size="compact" onRetry={() => void loadEcon()} /> : null}
                                    {!econLoading && !econError ? <>
                                    <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                                        <div>
                                            <label className="form-label fs-12 mb-1">Birim</label>
                                            <select className="form-select form-select-sm admin-user-unit" value={adjUnit} onChange={(e) => setAdjUnit(e.target.value as "XP" | "COIN")}>
                                                <option value="COIN">COIN</option>
                                                <option value="XP">XP</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label fs-12 mb-1">Miktar (±)</label>
                                            <input className="form-control form-control-sm admin-user-amount" type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
                                        </div>
                                        <div className="flex-fill admin-user-reason">
                                            <label className="form-label fs-12 mb-1">Sebep</label>
                                            <input className="form-control form-control-sm" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="örn. destek düzeltmesi" />
                                        </div>
                                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={submitAdjust}>Uygula</button>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-sm mb-0">
                                            <thead><tr><th>Tarih</th><th>Birim</th><th>Miktar</th><th>Durum</th><th>Sebep</th></tr></thead>
                                            <tbody>
                                                {(!econ || econ.ledger.length === 0) && (
                                                    <tr><td colSpan={5} className="text-center text-muted py-3">Kayıt yok.</td></tr>
                                                )}
                                                {econ?.ledger.map((l) => (
                                                    <tr key={l.id}>
                                                        <td className="text-nowrap fs-12">{new Date(l.createdAt).toLocaleString("tr-TR")}</td>
                                                        <td>{l.unit}</td>
                                                        <td className={l.amount < 0 ? "text-danger" : "text-success"}>{l.amount > 0 ? "+" : ""}{l.amount}</td>
                                                        <td className="fs-12">{l.status}</td>
                                                        <td className="fs-12">{l.reason}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {econ && econ.quests.length > 0 && (
                                        <div className="mt-3">
                                            <div className="fs-12 text-muted mb-2">Görevler (onboarding)</div>
                                            <div className="d-flex flex-column gap-1">
                                                {econ.quests.map((q) => (
                                                    <div key={q.id} className="d-flex align-items-center gap-2 fs-12">
                                                        <span className={q.completed ? "text-success" : "text-muted"}>{q.completed ? "✓" : "○"}</span>
                                                        <span className={q.completed ? "" : "text-muted"}>{q.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    </> : null}
                                </div>
                            </div>
                        </div>
                        <div className="col-12">
                            <div className="card stretch stretch-full">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <h6 className="mb-0">Abonelik</h6>
                                    {sub && (
                                        <div className="d-flex gap-3 fs-12 align-items-center">
                                            {sub.subscription
                                                ? <span>Durum: <StatusBadge tone={sub.subscription.status === "ACTIVE" ? "success" : sub.subscription.status === "TRIALING" ? "info" : sub.subscription.status === "PAST_DUE" ? "warning" : sub.subscription.status === "EXPIRED" ? "danger" : "neutral"}>{subscriptionStatusLabel(sub.subscription.status)}</StatusBadge></span>
                                                : <span className="text-muted">Abonelik yok</span>}
                                            <span>Premium: <strong>{sub.entitlement.isPremium ? "Evet" : "Hayır"}</strong>
                                                {sub.entitlement.validUntil ? <span className="text-muted"> · {new Date(sub.entitlement.validUntil).toLocaleDateString("tr-TR")}</span> : null}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="card-body">
                                    {subLoading ? <AsyncState status="loading" title="Abonelik verileri yükleniyor" size="compact" /> : null}
                                    {!subLoading && subError ? <AsyncState status="error" title="Abonelik verileri yüklenemedi" size="compact" onRetry={() => void loadSub()} /> : null}
                                    {!subLoading && !subError ? <>
                                    <dl className="row mb-3">
                                        <dt className="col-3 text-muted fs-12">Plan</dt>
                                        <dd className="col-9">{sub?.plan ? `${sub.plan.name} · ${fmtTry(sub.plan.priceMinor)} / ${sub.plan.periodMonths} ay` : "—"}</dd>
                                        <dt className="col-3 text-muted fs-12">Deneme bitişi</dt>
                                        <dd className="col-9">{sub?.subscription?.trialEndsAt ? new Date(sub.subscription.trialEndsAt).toLocaleDateString("tr-TR") : "—"}</dd>
                                        <dt className="col-3 text-muted fs-12">Dönem sonu</dt>
                                        <dd className="col-9">{sub?.subscription?.currentPeriodEnd ? new Date(sub.subscription.currentPeriodEnd).toLocaleDateString("tr-TR") : "—"}</dd>
                                    </dl>

                                    <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                                        {hasCharge && (
                                            <>
                                                <div>
                                                    <label className="form-label fs-12 mb-1">İade tutarı (kuruş)</label>
                                                    <input className="form-control form-control-sm admin-user-refund" type="number" min={1} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="örn. 24900" />
                                                </div>
                                                <div className="flex-fill admin-user-reason">
                                                    <label className="form-label fs-12 mb-1">İade sebebi</label>
                                                    <input className="form-control form-control-sm" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="örn. müşteri talebi" />
                                                </div>
                                                <button className="btn btn-sm btn-warning" disabled={busy} onClick={submitRefund}>İade yap</button>
                                            </>
                                        )}
                                        {sub?.subscription && !sub.subscription.cancelAtPeriodEnd && sub.subscription.status !== "EXPIRED" && (
                                            <button className="btn btn-sm btn-outline-danger ms-auto" disabled={busy} onClick={cancelSub}>Aboneliği iptal et</button>
                                        )}
                                    </div>

                                    <div className="table-responsive">
                                        <table className="table table-sm mb-0">
                                            <thead><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Durum</th></tr></thead>
                                            <tbody>
                                                {(!sub || sub.transactions.length === 0) && (
                                                    <tr><td colSpan={4} className="text-center text-muted py-3">İşlem yok.</td></tr>
                                                )}
                                                {sub?.transactions.map((t) => (
                                                    <tr key={t.id}>
                                                        <td className="text-nowrap fs-12">{new Date(t.createdAt).toLocaleString("tr-TR")}</td>
                                                        <td className="fs-12">{t.type}</td>
                                                        <td className={t.amountMinor < 0 ? "text-danger" : "text-success"}>{t.amountMinor > 0 ? "+" : ""}{fmtTry(t.amountMinor)}</td>
                                                        <td className="fs-12">{transactionStatusLabel(t.status)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    </> : null}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

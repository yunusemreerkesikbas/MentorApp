'use client'
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contentApi/authProvider";
import { isFullAccess } from "@/lib/roles";
import type { AdminUserDetail, AdminEconomyOverview, AdminSubscriptionView } from "@/lib/types";
import { UserEconomySection } from "./UserEconomySection";
import { UserOverviewSections, type UserStatus } from "./UserOverviewSections";
import { UserSubscriptionSection } from "./UserSubscriptionSection";

const fmtTry = (minor: number) => `${(minor / 100).toFixed(2)} ₺`;

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

    const changeStatus = async (status: UserStatus, label: string) => {
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

    return <>
        <AdminPageHeader title="Kullanıcı detayı" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Kullanıcılar", href: "/users" }, { label: user?.displayName ?? "Detay" }]} actions={<Link href="/users" className="btn btn-light"><FiArrowLeft aria-hidden="true" /> Kullanıcılar</Link>} />
        <div className="main-content">
            {loading ? <AsyncState status="loading" title="Kullanıcı yükleniyor" /> : null}
            {!loading && loadError ? <AsyncState status="error" title="Kullanıcı yüklenemedi" description="Kayıt bulunamadı veya bağlantı kurulamadı." onRetry={() => void load()} /> : null}
            {!loading && user ? <div className="row g-4">
                <UserOverviewSections busy={busy} canManageRoles={canManageRoles} user={user} onAnonymize={() => void anonymize()} onExport={() => void exportData()} onStatusChange={(status, label) => void changeStatus(status, label)} onToggleRole={(role) => void toggleRole(role)} />
                <UserEconomySection amount={adjAmount} busy={busy} data={econ} error={econError} loading={econLoading} reason={adjReason} unit={adjUnit} onAmountChange={setAdjAmount} onReasonChange={setAdjReason} onRetry={() => void loadEcon()} onSubmit={() => void submitAdjust()} onUnitChange={setAdjUnit} />
                <UserSubscriptionSection busy={busy} data={sub} error={subError} hasCharge={hasCharge} loading={subLoading} refundAmount={refundAmount} refundReason={refundReason} onCancel={() => void cancelSub()} onRefund={() => void submitRefund()} onRefundAmountChange={setRefundAmount} onRefundReasonChange={setRefundReason} onRetry={() => void loadSub()} />
            </div> : null}
        </div>
    </>;
}

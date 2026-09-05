import { AsyncState } from "@/components/shared/admin/AsyncState";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import type { AdminSubscriptionView } from "@/lib/types";

const formatTry = (minor: number) => `${(minor / 100).toFixed(2)} ₺`;
const statusLabel = (status: string) => ({ TRIALING: "Deneme", ACTIVE: "Aktif", PAST_DUE: "Ödeme bekliyor", CANCELED: "İptal edildi", EXPIRED: "Süresi doldu" }[status] ?? status);
const transactionStatusLabel = (status: string) => ({ SUCCEEDED: "Başarılı", FAILED: "Başarısız", REFUNDED: "İade edildi" }[status] ?? status);

interface UserSubscriptionSectionProps {
    busy: boolean;
    data: AdminSubscriptionView | null;
    error: boolean;
    hasCharge: boolean;
    loading: boolean;
    refundAmount: string;
    refundReason: string;
    onCancel: () => void;
    onRefund: () => void;
    onRefundAmountChange: (value: string) => void;
    onRefundReasonChange: (value: string) => void;
    onRetry: () => void;
}

export function UserSubscriptionSection({ busy, data, error, hasCharge, loading, refundAmount, refundReason, onCancel, onRefund, onRefundAmountChange, onRefundReasonChange, onRetry }: UserSubscriptionSectionProps) {
    const status = data?.subscription?.status;
    const tone = status === "ACTIVE" ? "success" : status === "TRIALING" ? "info" : status === "PAST_DUE" ? "warning" : status === "EXPIRED" ? "danger" : "neutral";
    return <div className="col-12"><div className="card stretch stretch-full">
        <div className="card-header d-flex align-items-center justify-content-between"><h6 className="mb-0">Abonelik</h6>{data ? <div className="d-flex gap-3 fs-12 align-items-center">{status ? <span>Durum: <StatusBadge tone={tone}>{statusLabel(status)}</StatusBadge></span> : <span className="text-muted">Abonelik yok</span>}<span>Premium: <strong>{data.entitlement.isPremium ? "Evet" : "Hayır"}</strong>{data.entitlement.validUntil ? <span className="text-muted"> · {new Date(data.entitlement.validUntil).toLocaleDateString("tr-TR")}</span> : null}</span></div> : null}</div>
        <div className="card-body">
            {loading ? <AsyncState status="loading" title="Abonelik verileri yükleniyor" size="compact" /> : null}
            {!loading && error ? <AsyncState status="error" title="Abonelik verileri yüklenemedi" size="compact" onRetry={onRetry} /> : null}
            {!loading && !error ? <>
                <dl className="row mb-3"><dt className="col-3 text-muted fs-12">Plan</dt><dd className="col-9">{data?.plan ? `${data.plan.name} · ${formatTry(data.plan.priceMinor)} / ${data.plan.periodMonths} ay` : "—"}</dd><dt className="col-3 text-muted fs-12">Deneme bitişi</dt><dd className="col-9">{data?.subscription?.trialEndsAt ? new Date(data.subscription.trialEndsAt).toLocaleDateString("tr-TR") : "—"}</dd><dt className="col-3 text-muted fs-12">Dönem sonu</dt><dd className="col-9">{data?.subscription?.currentPeriodEnd ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString("tr-TR") : "—"}</dd></dl>
                <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                    {hasCharge ? <><div><label className="form-label fs-12 mb-1" htmlFor="refund-amount">İade tutarı (kuruş)</label><input id="refund-amount" className="form-control form-control-sm admin-user-refund" type="number" min={1} value={refundAmount} onChange={(event) => onRefundAmountChange(event.target.value)} placeholder="örn. 24900" /></div><div className="flex-fill admin-user-reason"><label className="form-label fs-12 mb-1" htmlFor="refund-reason">İade sebebi</label><input id="refund-reason" className="form-control form-control-sm" value={refundReason} onChange={(event) => onRefundReasonChange(event.target.value)} placeholder="örn. müşteri talebi" /></div><button className="btn btn-sm btn-warning" disabled={busy} onClick={onRefund}>İade yap</button></> : null}
                    {data?.subscription && !data.subscription.cancelAtPeriodEnd && data.subscription.status !== "EXPIRED" ? <button className="btn btn-sm btn-outline-danger ms-auto" disabled={busy} onClick={onCancel}>Aboneliği iptal et</button> : null}
                </div>
                <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Durum</th></tr></thead><tbody>{(!data || data.transactions.length === 0) ? <tr><td colSpan={4} className="text-center text-muted py-3">İşlem yok.</td></tr> : null}{data?.transactions.map((transaction) => <tr key={transaction.id}><td className="text-nowrap fs-12">{new Date(transaction.createdAt).toLocaleString("tr-TR")}</td><td className="fs-12">{transaction.type}</td><td className={transaction.amountMinor < 0 ? "text-danger" : "text-success"}>{transaction.amountMinor > 0 ? "+" : ""}{formatTry(transaction.amountMinor)}</td><td className="fs-12">{transactionStatusLabel(transaction.status)}</td></tr>)}</tbody></table></div>
            </> : null}
        </div>
    </div></div>;
}

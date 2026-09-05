import { AsyncState } from "@/components/shared/admin/AsyncState";
import type { AdminEconomyOverview } from "@/lib/types";

interface UserEconomySectionProps {
    amount: string;
    busy: boolean;
    data: AdminEconomyOverview | null;
    error: boolean;
    loading: boolean;
    reason: string;
    unit: "XP" | "COIN";
    onAmountChange: (value: string) => void;
    onReasonChange: (value: string) => void;
    onRetry: () => void;
    onSubmit: () => void;
    onUnitChange: (value: "XP" | "COIN") => void;
}

export function UserEconomySection({ amount, busy, data, error, loading, reason, unit, onAmountChange, onReasonChange, onRetry, onSubmit, onUnitChange }: UserEconomySectionProps) {
    return <div className="col-12"><div className="card stretch stretch-full">
        <div className="card-header d-flex align-items-center justify-content-between"><h6 className="mb-0">Ekonomi</h6>{data ? <div className="d-flex gap-3 fs-12 align-items-center"><span>XP: <strong>{data.balance.xp}</strong></span><span>Coin: <strong>{data.balance.coinConfirmed}</strong>{data.balance.coinPending ? <span className="text-muted"> (+{data.balance.coinPending} beklemede)</span> : null}</span><span className="text-muted">Davet: {data.invite.converted}/{data.invite.invited}{data.invite.code ? ` · ${data.invite.code}` : ""}</span></div> : null}</div>
        <div className="card-body">
            {loading ? <AsyncState status="loading" title="Ekonomi verileri yükleniyor" size="compact" /> : null}
            {!loading && error ? <AsyncState status="error" title="Ekonomi verileri yüklenemedi" size="compact" onRetry={onRetry} /> : null}
            {!loading && !error ? <>
                <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                    <div><label className="form-label fs-12 mb-1" htmlFor="economy-unit">Birim</label><select id="economy-unit" className="form-select form-select-sm admin-user-unit" value={unit} onChange={(event) => onUnitChange(event.target.value as "XP" | "COIN")}><option value="COIN">COIN</option><option value="XP">XP</option></select></div>
                    <div><label className="form-label fs-12 mb-1" htmlFor="economy-amount">Miktar (±)</label><input id="economy-amount" className="form-control form-control-sm admin-user-amount" type="number" value={amount} onChange={(event) => onAmountChange(event.target.value)} /></div>
                    <div className="flex-fill admin-user-reason"><label className="form-label fs-12 mb-1" htmlFor="economy-reason">Sebep</label><input id="economy-reason" className="form-control form-control-sm" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="örn. destek düzeltmesi" /></div>
                    <button className="btn btn-sm btn-primary" disabled={busy} onClick={onSubmit}>Uygula</button>
                </div>
                <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr><th>Tarih</th><th>Birim</th><th>Miktar</th><th>Durum</th><th>Sebep</th></tr></thead><tbody>
                    {(!data || data.ledger.length === 0) ? <tr><td colSpan={5} className="text-center text-muted py-3">Kayıt yok.</td></tr> : null}
                    {data?.ledger.map((entry) => <tr key={entry.id}><td className="text-nowrap fs-12">{new Date(entry.createdAt).toLocaleString("tr-TR")}</td><td>{entry.unit}</td><td className={entry.amount < 0 ? "text-danger" : "text-success"}>{entry.amount > 0 ? "+" : ""}{entry.amount}</td><td className="fs-12">{entry.status}</td><td className="fs-12">{entry.reason}</td></tr>)}
                </tbody></table></div>
                {data && data.quests.length > 0 ? <div className="mt-3"><div className="fs-12 text-muted mb-2">Görevler (onboarding)</div><div className="d-flex flex-column gap-1">{data.quests.map((quest) => <div key={quest.id} className="d-flex align-items-center gap-2 fs-12"><span className={quest.completed ? "text-success" : "text-muted"}>{quest.completed ? "✓" : "○"}</span><span className={quest.completed ? "" : "text-muted"}>{quest.title}</span></div>)}</div></div> : null}
            </> : null}
        </div>
    </div></div>;
}

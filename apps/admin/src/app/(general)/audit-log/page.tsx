'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { AdminPageHeader } from "@/components/shared/admin/AdminPageHeader";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { InfoHint } from "@/components/shared/admin/InfoHint";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";
import type { AuditEntry } from "@/lib/types";

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("tr-TR");
}

function formatSnapshot(value: unknown) {
    if (value === null || value === undefined) return "Kayıt yok";
    return JSON.stringify(value, null, 2);
}

export default function AuditLogPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("tr-TR"));

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try { const { data } = await apiClient.get<AuditEntry[]>("/admin/audit-log"); setEntries(data); }
        catch { setEntries([]); setError(true); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const visibleEntries = useMemo(() => {
        if (!deferredQuery) return entries;
        return entries.filter((entry) => [entry.action, entry.targetType, entry.targetId, entry.actorUserId, entry.ip].some((value) => value?.toLocaleLowerCase("tr-TR").includes(deferredQuery)));
    }, [deferredQuery, entries]);

    const state = loading ? <AsyncState status="loading" title="Audit kayıtları yükleniyor" /> : error ? <AsyncState status="error" title="Audit kayıtları yüklenemedi" description="Bağlantıyı kontrol edip yeniden deneyin." onRetry={() => void load()} /> : entries.length === 0 ? <AsyncState status="empty" title="Henüz audit kaydı yok" description="Yönetim işlemleri gerçekleştikçe kayıtlar burada görünür." /> : visibleEntries.length === 0 ? <AsyncState status="empty" title="Aramayla eşleşen kayıt yok" description="Eylem, hedef veya aktör bilgisini değiştirerek yeniden deneyin." /> : undefined;

    return <>
        <AdminPageHeader title="İşlem geçmişi" breadcrumbs={[{ label: "Panel", href: "/" }, { label: "İşlem geçmişi" }]} />
        <div className="main-content"><DataTableShell state={state} toolbar={<div className="admin-table-toolbar-content"><div><div className="d-flex align-items-center gap-2"><h2 className="h6 mb-0">İşlem geçmişi</h2><InfoHint label="Audit kayıtları hakkında bilgi" content="Kayıtlar en yeniden eskiye sıralanır ve yalnız görüntülenebilir. Değişiklikler server tarafında append-only olarak saklanır." /></div><span className="text-muted fs-12">{visibleEntries.length} kayıt</span></div><div className="admin-table-search"><label className="visually-hidden" htmlFor="audit-search">Audit kayıtlarında ara</label><span className="input-group"><span className="input-group-text"><FiSearch aria-hidden="true" /></span><input id="audit-search" type="search" className="form-control" placeholder="Eylem, hedef veya aktör ara" value={query} onChange={(event) => setQuery(event.target.value)} /></span></div></div>}>
            <table className="table table-hover align-middle mb-0 audit-table"><thead><tr><th>Tarih</th><th>Eylem</th><th>Hedef</th><th>Değişiklik</th><th>Aktör</th><th>IP adresi</th></tr></thead><tbody>{visibleEntries.map((entry) => <tr key={entry.id}><td className="text-nowrap">{formatDate(entry.createdAt)}</td><td><StatusBadge tone="info">{entry.action}</StatusBadge></td><td>{entry.targetType ?? "Hedef yok"}<span className="admin-table-secondary font-monospace">{entry.targetId ?? "—"}</span></td><td><details className="admin-audit-details"><summary>Önce / sonra</summary><div className="admin-audit-snapshots"><div><strong>Önce</strong><pre>{formatSnapshot(entry.before)}</pre></div><div><strong>Sonra</strong><pre>{formatSnapshot(entry.after)}</pre></div></div></details></td><td><span className="font-monospace fs-12">{entry.actorUserId}</span></td><td><span className="font-monospace fs-12">{entry.ip ?? "—"}</span></td></tr>)}</tbody></table>
        </DataTableShell></div>
    </>;
}

"use client";
import { useEffect, useState } from "react";
import type { AdPlacementId, AdReadinessIssue, AdReadinessPlacement, AdReadinessReport } from "@mentor/types";
import { FormSection } from "@/components/shared/admin/FormSection";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import apiClient from "@/lib/apiClient";

const LABELS: Record<AdPlacementId, string> = {
    "knowledge.article.end": "Blog yazısı", "knowledge.index": "Blog listesi", "forum.question.end": "Herkese açık soru-cevap",
    "community.question.end": "Topluluk soru detayı", "community.announcement.end": "Duyuru detayı", "community.overview": "Topluluk Keşfet",
    "notebooks.overview": "Defterlerim", "vision.overview": "Hedef Panosu", "dashboard.rewarded.coin": "Ödüllü reklam",
};
const ISSUES: Record<AdReadinessIssue, string> = {
    GLOBAL_DISABLED: "Genel reklam anahtarı kapalı", DISPLAY_DISABLED: "Gösterim reklamları kapalı", PLACEMENT_DISABLED: "Alan kapalı",
    UNIT_MISSING: "Google birimi eksik", TEST_UNIT: "Google test birimi gelir envanteri değildir", COUNTRIES_EMPTY: "Ülke izin listesi boş",
    DISCOVERY_REVIEW_PENDING: "Keşfet için ayrı uygunluk onayı kapalı",
};
const CHECKS: Record<AdReadinessPlacement["contentCheck"], string> = {
    PUBLISHED_CONTENT: "Yayımlanmış içerik kontrolü", PROFILE: "Profil ve özel ekran uygunluğu",
    REVIEWED_VIEW: "Güncel görünüm için editör onayı", PUBLIC_DISCOVERY: "Açık görünüm ve ayrı uygunluk onayı",
};
type State = { status: "loading" } | { status: "error" } | { status: "ready"; report: AdReadinessReport };

export function AdsReadinessSummary() {
    const [state, setState] = useState<State>({ status: "loading" });
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        apiClient.get<AdReadinessReport>("/admin/ads/readiness", { signal: controller.signal })
            .then(({ data }) => { if (!controller.signal.aborted) setState({ status: "ready", report: data }); })
            .catch(() => { if (!controller.signal.aborted) setState({ status: "error" }); });
        return () => controller.abort();
    }, [revision]);
    const report = state.status === "ready" ? state.report : null;
    return <FormSection title="Reklam yayınına hazırlık" hint="Bu özet yalnız bu ortamın yapılandırmasını gösterir. Google onayı veya bir kullanıcıya reklam gösterilebileceği anlamına gelmez.">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <p role="status" className="mb-0">{state.status === "loading" ? "Reklam ayarları kontrol ediliyor…" : state.status === "error" ? "Hazırlık özeti alınamadı. Ayarlar için olumlu durum varsayılmadı." : `Son kontrol: ${new Date(report!.checkedAt).toLocaleString("tr-TR")}`}</p>
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={state.status === "loading"}
                onClick={() => { setState({ status: "loading" }); setRevision((value) => value + 1); }}>Özeti yenile</button>
        </div>
        {report ? <>
            <div className="d-flex flex-wrap gap-2 mb-3">
                <StatusBadge tone="info">Ortam: {({ development: "Geliştirme", staging: "Test yayını", production: "Üretim" })[report.environment]}</StatusBadge>
                <StatusBadge tone="neutral">Genel reklam anahtarı: {report.globalEnabled ? "Açık" : "Kapalı"}</StatusBadge>
                <StatusBadge tone="neutral">Gösterim reklamları: {report.displayEnabled ? "Açık" : "Kapalı"}</StatusBadge>
                <StatusBadge tone="neutral">Ülke izin listesi: {report.allowedCountries.join(", ") || "Boş"}</StatusBadge>
            </div>
            {report.localTestActive ? <p className="alert alert-warning" role="note">Yerel Google test modu açık. Görünen test reklamları yayıncı geliri değildir; aşağıdaki kontroller gerçek yayın ayarları içindir.</p> : null}
            <div className="table-responsive">
                <table className="table align-middle" aria-label="Reklam alanlarının yapılandırma durumu">
                    <thead><tr><th scope="col">Ekran</th><th scope="col">Alan</th><th scope="col">Google birimi</th><th scope="col">Kalan kontroller</th></tr></thead>
                    <tbody>{report.placements.map((row) => <tr key={row.id}>
                        <th scope="row">{LABELS[row.id]}<small className="d-block fw-normal text-muted">{row.authenticatedOnly ? "Oturum gerekli" : "Uygun anonim kullanım da desteklenir"}</small></th>
                        <td>{row.enabled ? "Açık" : "Kapalı"}</td>
                        <td>{row.unitStatus === "MISSING" ? "Eksik" : row.unitStatus === "TEST_UNIT" ? "Test envanteri" : "Birim yolu tanımlı"}
                            <small className="d-block text-muted">{({ CONFIG: "Merkezi ayar", ENV: "Ortam ayarı", NONE: "Kaynak yok" })[row.unitSource]}</small></td>
                        <td>{row.issues.length ? <ul className="mb-1 ps-3">{row.issues.map((issue) => <li key={issue}>{ISSUES[issue]}</li>)}</ul> : <p className="mb-1">Yapılandırma engeli görünmüyor; yayın onayları ayrıca gerekli.</p>}
                            <small className="text-muted">{CHECKS[row.contentCheck]}</small></td>
                    </tr>)}</tbody>
                </table>
            </div>
            <p>Google hesap/site onayı, gerçek envanter, güncel içerik onayları, güvenli tarama ve gizlilik/bilgilendirme incelemesi bu raporda doğrulanmaz. Bu adımlar tamamlanmadan alanları açma.</p>
            {report.siteOrigin ? <p>Yapılandırılmış web adresindeki <a href={`${report.siteOrigin}/ads.txt`} target="_blank" rel="noopener noreferrer">ads.txt dosyasını aç</a>. Canlı kök alan adında da yayıncı kimliği ayrıca doğrulanmalı.</p> : <p>Web adresi doğrulanamadı; ads.txt canlı kök alan adında ayrıca kontrol edilmeli.</p>}
        </> : null}
    </FormSection>;
}

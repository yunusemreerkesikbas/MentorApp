import { FiEdit2, FiPlus } from "react-icons/fi";
import { AdminPageHeader } from "./AdminPageHeader";
import { AsyncState } from "./AsyncState";
import { DataTableShell } from "./DataTableShell";
import { FieldLabel } from "./FieldLabel";
import { FormSection } from "./FormSection";
import { IconAction } from "./IconAction";
import { InfoHint } from "./InfoHint";
import { BucketDonut } from "./dashboard/BucketDonut";
import { DashboardSection, DashboardSkeleton } from "./dashboard/DashboardSection";
import { KpiStatRow } from "./dashboard/KpiStatRow";
import { MetricStrip } from "./dashboard/MetricStrip";
import { ProgressStatRow } from "./dashboard/ProgressStatRow";
import { WindowSparkBars } from "./dashboard/WindowSparkBars";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";

export function AdminCoreContract() {
    return (
        <>
            <AdminPageHeader
                title="Kampanyalar"
                breadcrumbs={[{ label: "Panel", href: "/" }, { label: "Kampanyalar" }]}
                actions={<button type="button">Yeni kampanya</button>}
            />
            <InfoHint label="Alan açıklaması" content="Kısa ve yararlı açıklama." />
            <FieldLabel htmlFor="name" label="Ad" hint="Yalnız yöneticiler görür." required />
            <AsyncState status="loading" title="Kampanyalar yükleniyor" size="compact" />
            <AsyncState status="error" title="Kampanyalar yüklenemedi" onRetry={() => undefined} />
            <DataTableShell toolbar={<div>Filtre</div>} state={<div>Durum</div>}>
                <table><tbody><tr><td>Kampanya</td></tr></tbody></table>
            </DataTableShell>
            <FormSection title="Tanım" hint="Bölüm açıklaması"><input /></FormSection>
            <MetricCard icon={<FiPlus />} value={24} label="Yeni kullanıcı" hint="Son 7 gün" />
            <DashboardSection title="Kullanıcılar">
                <KpiStatRow items={[{ id: "users", icon: "feather-users", title: "Toplam kullanıcı", value: 24, hint: "Son 7 gün", href: "/users" }]} />
                <ProgressStatRow items={[{ id: "invite", icon: "feather-link-2", title: "Davet", value: "2/10", progress: { label: "2 dönüşen", percent: 20 } }]} />
                <MetricStrip title="Dağılım" items={[{ id: "kpss", icon: "feather-clipboard", title: "KPSS", value: 12 }]} />
                <BucketDonut title="Sınav tipi" items={[{ id: "kpss", label: "KPSS", value: 12 }]} />
                <WindowSparkBars items={[{ id: "d1", title: "24s", value: "12", color: "#3454D1", categories: ["24s", "7g", "30g"], data: [1, 7, 30] }]} />
            </DashboardSection>
            <DashboardSkeleton title="Metrikler yükleniyor" cards={2} />
            <StatusBadge tone="success">Yayında</StatusBadge>
            <IconAction href="/promotions/1" label="Kampanyayı düzenle" icon={<FiEdit2 />} />
            <IconAction onClick={() => undefined} label="Yeni kampanya" icon={<FiPlus />} />
            {/* @ts-expect-error Link and button behaviors are mutually exclusive. */}
            <IconAction href="/promotions/1" onClick={() => undefined} label="Geçersiz" icon={<FiPlus />} />
        </>
    );
}

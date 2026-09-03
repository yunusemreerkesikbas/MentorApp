import { FiEdit2, FiPlus } from "react-icons/fi";
import { AdminPageHeader } from "./AdminPageHeader";
import { AsyncState } from "./AsyncState";
import { DataTableShell } from "./DataTableShell";
import { FieldLabel } from "./FieldLabel";
import { FormSection } from "./FormSection";
import { IconAction } from "./IconAction";
import { InfoHint } from "./InfoHint";
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
            <StatusBadge tone="success">Yayında</StatusBadge>
            <IconAction href="/promotions/1" label="Kampanyayı düzenle" icon={<FiEdit2 />} />
            <IconAction onClick={() => undefined} label="Yeni kampanya" icon={<FiPlus />} />
            {/* @ts-expect-error Link and button behaviors are mutually exclusive. */}
            <IconAction href="/promotions/1" onClick={() => undefined} label="Geçersiz" icon={<FiPlus />} />
        </>
    );
}

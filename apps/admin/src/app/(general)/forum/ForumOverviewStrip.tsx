import { DashboardIcon } from "@/components/shared/admin/dashboard/dashboard-icon";
import { textToneClass } from "@/components/shared/admin/dashboard/tone";
import type { DashboardTone } from "@/components/shared/admin/dashboard/types";

type OverviewItem = {
    id: string;
    icon: string;
    title: string;
    value: string | number;
    tone: DashboardTone;
};

export function ForumOverviewStrip({
    zoneCount,
    tagCount,
    pendingSuggestionCount,
    featuredActive,
}: {
    zoneCount: number;
    tagCount: number;
    pendingSuggestionCount: number;
    featuredActive: boolean;
}) {
    const items: OverviewItem[] = [
        { id: "zones", icon: "feather-grid", title: "Odalar", value: zoneCount, tone: "primary" },
        { id: "tags", icon: "feather-tag", title: "Etiket", value: tagCount, tone: "teal" },
        { id: "suggestions", icon: "feather-list", title: "Bekleyen öneri", value: pendingSuggestionCount, tone: pendingSuggestionCount > 0 ? "warning" : "muted" },
        { id: "featured", icon: "feather-star", title: "Öne çıkan", value: featuredActive ? "Aktif" : "Yok", tone: featuredActive ? "success" : "muted" },
    ];

    return (
        <article className="card stretch stretch-full">
            <div className="card-body">
                <div className="hstack justify-content-between mb-4">
                    <div>
                        <h5 className="mb-1">Topluluk özeti</h5>
                        <span className="fs-12 text-muted">Bu sayfadaki kayıtlardan.</span>
                    </div>
                </div>
                <div className="row">
                    {items.map((item) => (
                        <div className="col-xxl-3 col-lg-6 email-overview-card" key={item.id}>
                            <div className="card stretch stretch-full border border-dashed border-gray-5">
                                <div className="card-body rounded-3 text-center">
                                    <span className={`fs-3 ${textToneClass(item.tone)}`}>
                                        <DashboardIcon name={item.icon} size={22} />
                                    </span>
                                    <div className="fs-4 fw-bolder text-dark mt-3 mb-1">{item.value}</div>
                                    <p className="fs-12 fw-medium text-muted text-spacing-1 mb-0 text-truncate-1-line">{item.title}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </article>
    );
}

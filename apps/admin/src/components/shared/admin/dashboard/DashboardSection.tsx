import type { ReactNode } from "react";
import { AsyncState } from "../AsyncState";

export function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">{title}</h2>
            {children}
        </section>
    );
}

export function DashboardSkeleton({ title, cards = 4 }: { title: string; cards?: number }) {
    return (
        <section className="admin-dashboard-section" aria-busy="true">
            <h2 className="admin-dashboard-section-title">{title}</h2>
            <div className="row g-4">
                {Array.from({ length: cards }, (_, index) => (
                    <div className="col-xxl-3 col-md-6" key={index}>
                        <div className="card stretch stretch-full admin-dashboard-skeleton-card">
                            <div className="card-body">
                                <AsyncState status="loading" size="compact" title={title} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function DashboardError({
    title,
    description,
    onRetry,
}: {
    title: string;
    description: string;
    onRetry: () => void;
}) {
    return (
        <DashboardSection title={title}>
            <div className="card stretch stretch-full">
                <AsyncState status="error" size="compact" title={`${title} yüklenemedi`} description={description} onRetry={onRetry} />
            </div>
        </DashboardSection>
    );
}

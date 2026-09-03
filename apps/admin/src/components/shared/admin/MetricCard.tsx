import type { ReactNode } from "react";
import { InfoHint } from "./InfoHint";

type MetricCardProps = {
    icon: ReactNode;
    value: ReactNode;
    label: string;
    hint?: string;
};

export function MetricCard({ icon, value, label, hint }: MetricCardProps) {
    return (
        <article className="card stretch stretch-full admin-metric-card">
            <div className="card-body">
                <div className="d-flex align-items-center gap-3">
                    <span className="admin-metric-icon bg-soft-primary text-primary" aria-hidden="true">
                        {icon}
                    </span>
                    <div className="min-w-0">
                        <div className="admin-metric-value text-dark">{value}</div>
                        <div className="admin-metric-label text-muted">
                            <span>{label}</span>
                            {hint ? <InfoHint label={`${label} açıklaması`} content={hint} /> : null}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

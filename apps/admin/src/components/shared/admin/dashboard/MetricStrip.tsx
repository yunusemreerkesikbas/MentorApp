import Link from "next/link";
import { DashboardIcon } from "./dashboard-icon";
import { textToneClass } from "./tone";
import type { StripItem } from "./types";

export function MetricStrip({
    title,
    subtitle,
    href,
    hrefLabel,
    items,
}: {
    title: string;
    subtitle?: string;
    href?: string;
    hrefLabel?: string;
    items: StripItem[];
}) {
    return (
        <div className="row g-4">
            <div className="col-12">
                <article className="card stretch stretch-full">
                    <div className="card-body">
                        <div className="hstack justify-content-between mb-4">
                            <div>
                                <h5 className="mb-1">{title}</h5>
                                {subtitle ? <span className="fs-12 text-muted">{subtitle}</span> : null}
                            </div>
                            {href ? (
                                <Link href={href} className="btn btn-light-brand">
                                    {hrefLabel ?? "Tümü"}
                                </Link>
                            ) : null}
                        </div>
                        {items.length === 0 ? (
                            <p className="text-muted mb-0">Kayıt yok</p>
                        ) : (
                            <div className="row">
                                {items.map((item) => {
                                    const tone = item.tone ?? "primary";
                                    return (
                                        <div className="col-xxl-2 col-lg-4 col-md-6 email-overview-card" key={item.id}>
                                            <div className="card stretch stretch-full border border-dashed border-gray-5">
                                                <div className="card-body rounded-3 text-center">
                                                    <span className={`fs-3 ${textToneClass(tone)}`}>
                                                        <DashboardIcon name={item.icon} size={22} />
                                                    </span>
                                                    <div className="fs-4 fw-bolder text-dark mt-3 mb-1">{item.value}</div>
                                                    <p className="fs-12 fw-medium text-muted text-spacing-1 mb-0 text-truncate-1-line">{item.title}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </article>
            </div>
        </div>
    );
}

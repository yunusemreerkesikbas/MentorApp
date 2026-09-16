import Link from "next/link";
import { InfoHint } from "../InfoHint";
import { DashboardIcon } from "./dashboard-icon";
import { avatarToneClass, badgeToneClass } from "./tone";
import type { KpiItem } from "./types";

export function KpiStatRow({ items }: { items: KpiItem[] }) {
    if (items.length === 0) return null;

    return (
        <div className="row g-4">
            {items.map((item) => {
                const tone = item.tone ?? "primary";
                const value = <span className="fs-24 fw-bolder d-block">{item.value}</span>;

                return (
                    <div className="col-xxl-3 col-md-6" key={item.id}>
                        <article className="card stretch stretch-full">
                            <div className="card-body">
                                <div className="d-flex align-items-center justify-content-between gap-3">
                                    <div className="d-flex align-items-center gap-3 min-w-0">
                                        <div className={`avatar-text avatar-xl rounded ${avatarToneClass(tone)}`}>
                                            <DashboardIcon name={item.icon} size={17} />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="fw-bold d-block">
                                                <span className="text-truncate-1-line d-inline-flex align-items-center gap-1">
                                                    {item.href ? (
                                                        <Link href={item.href} className="text-decoration-none text-reset">
                                                            {item.title}
                                                        </Link>
                                                    ) : item.title}
                                                    {item.hint ? <InfoHint label={`${item.title} açıklaması`} content={item.hint} /> : null}
                                                </span>
                                                {item.href ? (
                                                    <Link href={item.href} className="text-decoration-none text-reset">
                                                        {value}
                                                    </Link>
                                                ) : value}
                                            </span>
                                            {item.subtitle ? <p className="fs-12 text-muted mb-0">{item.subtitle}</p> : null}
                                        </div>
                                    </div>
                                    {item.badge ? (
                                        <span className={`badge ${badgeToneClass(item.badge.tone)}`}>{item.badge.text}</span>
                                    ) : null}
                                </div>
                            </div>
                        </article>
                    </div>
                );
            })}
        </div>
    );
}

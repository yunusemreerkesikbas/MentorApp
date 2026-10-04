import Link from "next/link";
import { InfoHint } from "../InfoHint";
import { DashboardIcon } from "./dashboard-icon";
import { clampPercent, progressToneClass } from "./tone";
import type { KpiItem } from "./types";

export function ProgressStatRow({ items, colClass = "col-xxl-3 col-md-6" }: { items: KpiItem[]; colClass?: string }) {
    if (items.length === 0) return null;

    return (
        <div className="row g-4">
            {items.map((item) => {
                const tone = item.tone ?? "primary";
                const percent = item.progress ? clampPercent(item.progress.percent) : null;
                const heading = (
                    <>
                        <div className="fs-4 fw-bold text-dark">
                            {item.href ? (
                                <Link href={item.href} className="text-decoration-none text-reset">{item.value}</Link>
                            ) : item.value}
                        </div>
                        <h3 className="fs-13 fw-semibold text-truncate-1-line mb-0">
                            {item.href ? (
                                <Link href={item.href} className="text-decoration-none text-reset">{item.title}</Link>
                            ) : item.title}
                            {item.hint ? <InfoHint label={`${item.title} açıklaması`} content={item.hint} /> : null}
                        </h3>
                    </>
                );

                return (
                    <div className={colClass} key={item.id}>
                        <article className="card stretch stretch-full short-info-card">
                            <div className="card-body">
                                <div className="d-flex align-items-start justify-content-between mb-4">
                                    <div className="d-flex gap-4 align-items-center">
                                        <div className="avatar-text avatar-lg bg-gray-200 icon">
                                            <DashboardIcon name={item.icon} size={16} />
                                        </div>
                                        <div>
                                            {heading}
                                        </div>
                                    </div>
                                </div>
                                {item.progress && percent !== null ? (
                                    <div className="pt-4">
                                        <div className="d-flex align-items-center justify-content-between gap-2">
                                            <span className="fs-12 fw-medium text-muted text-truncate-1-line">{item.title}</span>
                                            <span className="fs-12 text-dark">{item.progress.label}</span>
                                        </div>
                                        <div className="progress mt-2 ht-3">
                                            <div
                                                className={`progress-bar ${progressToneClass(tone)}`}
                                                role="progressbar"
                                                style={{ width: `${percent}%` }}
                                                aria-valuenow={percent}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </article>
                    </div>
                );
            })}
        </div>
    );
}

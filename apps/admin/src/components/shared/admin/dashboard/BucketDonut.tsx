"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import type { BucketItem } from "./types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const DONUT_COLORS = ["#3454d1", "#1565c0", "#1976d2", "#1e88e5", "#2196f3", "#42a5f5"];

function donutOptions(labels: string[], reducedMotion: boolean): ApexOptions {
    return {
        labels,
        colors: DONUT_COLORS,
        chart: { animations: { enabled: !reducedMotion } },
        dataLabels: { enabled: false },
        stroke: { width: 0 },
        legend: { show: false },
        plotOptions: {
            pie: {
                donut: {
                    size: "78%",
                    labels: { show: false },
                },
            },
        },
        tooltip: {
            y: {
                formatter: (value: number) => value.toLocaleString("tr-TR"),
            },
            style: { fontFamily: "Inter" },
        },
    };
}

export function BucketDonut({
    title,
    items,
    colClass = "col-xxl-6",
}: {
    title: string;
    items: BucketItem[];
    colClass?: string;
}) {
    const reducedMotion = usePrefersReducedMotion();
    const hasData = items.some((item) => item.value > 0);

    return (
        <div className={colClass}>
            <article className="card stretch stretch-full leads-overview">
                <div className="card-header">
                    <h6 className="mb-0">{title}</h6>
                </div>
                <div className="card-body">
                    {!hasData ? (
                        <p className="text-muted text-center mb-0 py-4">Kayıt yok</p>
                    ) : (
                        <>
                            <ReactApexChart
                                type="donut"
                                options={donutOptions(items.map((item) => item.label), reducedMotion)}
                                series={items.map((item) => item.value)}
                                height={220}
                            />
                            <div className="row g-2 pt-2">
                                {items.map((item, index) => (
                                    <div className="col-4" key={item.id}>
                                        <div className="p-2 hstack gap-2 rounded border border-dashed border-gray-5">
                                            <span
                                                className="wd-7 ht-7 rounded-circle d-inline-block"
                                                style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                                                aria-hidden="true"
                                            />
                                            <span>
                                                {item.label}
                                                <span className="fs-10 text-muted ms-1">({item.value.toLocaleString("tr-TR")})</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </article>
        </div>
    );
}

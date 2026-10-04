"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { DashboardIcon } from "./dashboard-icon";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import type { WindowSeries } from "./types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

function barOptions(item: WindowSeries, reducedMotion: boolean): ApexOptions {
    return {
        chart: {
            stacked: true,
            toolbar: { show: false },
            animations: { enabled: !reducedMotion },
        },
        colors: [item.color],
        plotOptions: {
            bar: {
                borderRadius: 3,
                borderRadiusApplication: "end",
                columnWidth: "28%",
            },
        },
        grid: {
            show: false,
            padding: { top: 0, right: 12, bottom: 0, left: 8 },
        },
        legend: { show: false },
        dataLabels: { enabled: false },
        xaxis: {
            categories: item.categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                show: true,
                style: { colors: "#A0ACBB", fontFamily: "Inter", fontSize: "11px" },
            },
        },
        yaxis: { labels: { show: false } },
        tooltip: {
            y: {
                formatter: (value: number) => value.toLocaleString("tr-TR"),
            },
            style: { fontFamily: "Inter" },
        },
    };
}

export function WindowSparkBars({ items }: { items: WindowSeries[] }) {
    const reducedMotion = usePrefersReducedMotion();
    if (items.length === 0) return null;

    return (
        <div className="row g-4">
            {items.map((item) => (
                <div className="col-xxl-4 col-md-6" key={item.id}>
                    <article className="card stretch stretch-full">
                        <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between">
                                <div className="avatar-text avatar-lg bg-soft-primary text-primary rounded">
                                    <DashboardIcon name="feather-bar-chart-2" size={16} />
                                </div>
                                <div className="text-end">
                                    <p className="fs-11 fw-medium text-uppercase text-muted mb-1">{item.title}</p>
                                    <h3 className="tx-20 tx-semibold mb-0">{item.value}</h3>
                                </div>
                            </div>
                        </div>
                        <ReactApexChart
                            type="bar"
                            options={barOptions(item, reducedMotion)}
                            series={[{ name: item.title, data: item.data }]}
                            height={120}
                        />
                    </article>
                </div>
            ))}
        </div>
    );
}

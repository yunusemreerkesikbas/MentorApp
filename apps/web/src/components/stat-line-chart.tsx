"use client";

import { ResponsiveLine } from "@nivo/line";

export interface StatLineChartPoint {
  x: string;
  y: number;
}

export interface StatLineChartSeries {
  id: string;
  data: StatLineChartPoint[];
}

export interface StatLineChartProps {
  data: StatLineChartSeries[];
  ariaLabel: string;
  height?: number;
  /** DESIGN token color for the line/area (default accent). */
  color?: string;
  /** Appended to the value in the hover tooltip, e.g. " net". */
  valueSuffix?: string;
  /** No axes/grid — bare line + area + points, for tight KPI-band spark use. */
  compact?: boolean;
}

/**
 * Themed Nivo line chart (DESIGN tokens, Plus Jakarta Sans, `shadow-card` tooltip).
 * Stat-card charting infrastructure — wire more chart types here as surfaces adopt it.
 */
export function StatLineChart({
  data,
  ariaLabel,
  height = 200,
  color = "var(--color-accent)",
  valueSuffix = "",
  compact = false,
}: StatLineChartProps) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveLine
        data={data}
        margin={
          compact
            ? { top: 10, right: 10, bottom: 10, left: 10 }
            : { top: 14, right: 20, bottom: 8, left: 32 }
        }
        xScale={{ type: "point" }}
        enableCrosshair={false}
        yScale={{ type: "linear", min: "auto", max: "auto", nice: true }}
        curve="monotoneX"
        colors={[color]}
        lineWidth={2.5}
        enableArea
        areaOpacity={0.14}
        enablePoints
        pointSize={compact ? 6 : 9}
        pointColor={{ from: "serieColor" }}
        pointBorderWidth={2}
        pointBorderColor="#ffffff"
        enableGridX={false}
        enableGridY={!compact}
        gridYValues={4}
        axisBottom={null}
        axisLeft={compact ? null : { tickSize: 0, tickPadding: 8, tickValues: 4 }}
        theme={{
          axis: {
            ticks: {
              text: {
                fill: "var(--color-secondary)",
                fontFamily: "var(--font-body)",
                fontSize: 11,
              },
            },
          },
          grid: {
            line: {
              stroke: "color-mix(in srgb, var(--color-main) 8%, transparent)",
              strokeDasharray: "3 4",
            },
          },
        }}
        tooltip={({ point }) => (
          <div
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-card)] px-2.5 py-1.5 text-xs"
            style={{
              background: "#ffffff",
              color: "var(--color-main)",
              fontFamily: "var(--font-body)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: point.seriesColor }}
            />
            <span style={{ color: "var(--color-secondary)" }}>
              {point.data.xFormatted}
            </span>
            <strong className="font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {point.data.yFormatted}
              {valueSuffix}
            </strong>
          </div>
        )}
        useMesh
        animate
        motionConfig="gentle"
      />
    </div>
  );
}

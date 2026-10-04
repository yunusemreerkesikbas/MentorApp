"use client";

import { useId } from "react";
import { ResponsiveLine } from "@nivo/line";
import type { DotsItemSymbolProps } from "@nivo/core";

export interface StatLineChartPoint {
  /** Unique per point (an id, not a label): two exams on one day must stay two points. */
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
  /** Appended to the value in the tooltip and the table, e.g. " net". */
  valueSuffix?: string;
  /** Turns a point's `x` into its label (axis ticks, tooltip, table). */
  formatX?: (x: string) => string;
  /** A longer label for the tooltip and the table than the axis has room for. Defaults to `formatX`. */
  describeX?: (x: string) => string;
  /** A labelled threshold across the plot, e.g. the personal record. */
  marker?: { value: number; label: string };
  /** Caption of the screen-reader table that carries every value (dataviz: tooltips never gate). */
  tableCaption?: string;
}

const identity = (x: string) => x;

/** Small dot for older points; a "you are here" ring for the latest one. */
function makePointSymbol(color: string, lastIndex: number) {
  return function StatLinePointSymbol({
    size,
    datum,
  }: DotsItemSymbolProps<{ indexInSeries: number }>) {
    const isLast = datum.indexInSeries === lastIndex;
    if (!isLast) {
      return <circle r={size * 0.45} fill={color} opacity={0.5} />;
    }
    return (
      <g>
        <circle r={size * 1.7} fill={color} opacity={0.16} />
        <circle r={size * 0.85} fill={color} stroke="var(--color-surface)" strokeWidth={2.5} />
      </g>
    );
  };
}

/**
 * Themed Nivo line chart (DESIGN tokens, Nunito, `shadow-card` tooltip). Solid hairline grid; the
 * only dashed line is a marker, because dashing means "threshold". Every value is also in a
 * visually hidden table.
 */
export function StatLineChart({
  data,
  ariaLabel,
  height = 200,
  color = "var(--color-accent)",
  valueSuffix = "",
  formatX = identity,
  describeX = formatX,
  marker,
  tableCaption,
}: StatLineChartProps) {
  const points = data[0]?.data ?? [];
  const lastIndex = points.length - 1;
  // Unique per instance — a shared literal id would collide when multiple charts render on
  // the same page, and the browser resolves `url(#id)` to whichever element matches first.
  const gradientId = `stat-line-gradient-${useId()}`;
  // Every other tick past six points, always keeping the latest one.
  const step = points.length > 6 ? 2 : 1;
  const tickValues = points
    .map((point) => point.x)
    .filter((_, index) => (lastIndex - index) % step === 0);
  const textStyle = {
    fill: "var(--color-secondary)",
    fontFamily: "var(--font-body)",
    fontSize: 11,
    fontWeight: 700,
  };

  return (
    <div>
      <div role="img" aria-label={ariaLabel} style={{ height }}>
        <ResponsiveLine
          data={data}
          margin={{ top: 16, right: 20, bottom: 28, left: 36 }}
          xScale={{ type: "point" }}
          enableCrosshair={false}
          yScale={{ type: "linear", min: "auto", max: "auto", nice: true }}
          yFormat=" >-.2f"
          curve="monotoneX"
          colors={[color]}
          lineWidth={2.5}
          enableArea
          defs={[
            {
              id: gradientId,
              type: "linearGradient",
              colors: [
                { offset: 0, color, opacity: 0.22 },
                { offset: 100, color, opacity: 0.02 },
              ],
            },
          ]}
          fill={[{ match: "*", id: gradientId }]}
          enablePoints
          pointSize={9}
          pointSymbol={makePointSymbol(color, lastIndex)}
          enableGridX={false}
          gridYValues={4}
          axisBottom={{ tickSize: 0, tickPadding: 10, tickValues, format: formatX }}
          axisLeft={{ tickSize: 0, tickPadding: 8, tickValues: 4 }}
          markers={
            marker
              ? [
                  {
                    axis: "y" as const,
                    value: marker.value,
                    lineStyle: {
                      stroke: "var(--color-secondary)",
                      strokeWidth: 1.5,
                      strokeDasharray: "5 5",
                      opacity: 0.6,
                    },
                    legend: marker.label,
                    legendPosition: "top-right" as const,
                    textStyle: { ...textStyle, fontWeight: 800 },
                  },
                ]
              : []
          }
          theme={{
            axis: { ticks: { text: textStyle } },
            grid: {
              line: { stroke: "color-mix(in srgb, var(--color-main) 8%, transparent)" },
            },
          }}
          tooltip={({ point }) => (
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-card)] border border-[var(--play-line)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-main)] shadow-[var(--shadow-card)]">
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: point.seriesColor }}
              />
              <span className="font-bold text-[var(--color-secondary)]">
                {describeX(String(point.data.x))}
              </span>
              <strong className="font-black tabular-nums">
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
      {tableCaption ? (
        // The wrapper hides it: a table ignores `sr-only`'s 1px width, and one with long row labels
        // widened the page on a phone.
        <div className="sr-only">
          <table>
            <caption>{tableCaption}</caption>
            <tbody>
              {points.map((point) => (
                <tr key={point.x}>
                  <th scope="row">{describeX(point.x)}</th>
                  <td>
                    {point.y.toFixed(2)}
                    {valueSuffix}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

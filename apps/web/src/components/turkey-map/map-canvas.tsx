"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { CityDto, UniversityDto } from "@mentor/types";
import { PROVINCES } from "./paths.generated";
import { projectLngLat } from "./projection";
import { useMapViewport } from "./use-map-viewport";

/**
 * Teardrop map pin whose tip sits at (0,0), so a pin translated to a projected point marks that
 * exact spot rather than hovering above or below it. ~14 wide, ~20 tall at unit scale.
 */
const PIN_PATH = "M0,0 C-4,-6 -7,-9 -7,-13 A7,7 0 1,1 7,-13 C7,-9 4,-6 0,0 Z";
/** Pins keep a constant screen size, but shrink a little at country zoom so 58 in İstanbul still read. */
const PIN_SCALE = 0.55;

interface PlacedUniversity {
  x: number;
  y: number;
  university: UniversityDto;
  cityCode: string;
}

/**
 * The map: provinces plus one pin per university, at every zoom level.
 *
 * Pins are deliberately NOT clustered. Clustering reads better where universities pile up
 * (İstanbul has 58 inside a province ~35 units wide) but it answers a different question — the
 * point here is to see *the universities*, and a badge reading "58" is not that. Overlap in the
 * three dense provinces is the accepted cost; zooming separates them.
 */
export function MapCanvas({
  cities,
  selectedCityCode,
  activeUniversityId,
  overlay,
  onSelectCity,
  onSelectUniversity,
  onHoverUniversity,
}: {
  cities: CityDto[];
  selectedCityCode: string | null;
  activeUniversityId: string | null;
  /**
   * Anything to pin over a province — the mascot standing on the target city. Kept generic so the
   * map does not need to know about mascots, and rendered as an HTML layer rather than inside the
   * SVG so it keeps a constant size no matter how far the viewBox is zoomed.
   */
  overlay?: { cityCode: string; node: React.ReactNode } | null;
  onSelectCity: (code: string) => void;
  onSelectUniversity: (university: UniversityDto) => void;
  /** `null` clears the preview; the rect anchors the card next to the pin. */
  onHoverUniversity: (university: UniversityDto | null, rect: DOMRect | null) => void;
}) {
  const t = useTranslations("vision.map");
  const { view, viewBox, unit, isZoomed, reset, zoomToBox, zoomIn, zoomOut, handlers } =
    useMapViewport();

  const overlayShape = overlay ? PROVINCES[overlay.cityCode] : null;
  const overlayPos = overlayShape
    ? {
        left: ((overlayShape.cx - view.x) / view.w) * 100,
        top: ((overlayShape.cy - view.y) / view.h) * 100,
      }
    : null;
  // Hide it once the city is panned off screen instead of pinning it to the nearest edge, where
  // it would claim to mark a place it no longer points at.
  const overlayVisible =
    overlayPos != null &&
    overlayPos.left >= 0 &&
    overlayPos.left <= 100 &&
    overlayPos.top >= 0 &&
    overlayPos.top <= 100;

  const placed = useMemo<PlacedUniversity[]>(() => {
    const out: PlacedUniversity[] = [];
    for (const city of cities) {
      for (const university of city.universities) {
        // 16 of 206 have no confirmed fix. They stay in the sidebar list but get no pin — a gap
        // is honest, a pin in the wrong place is not.
        if (university.latitude == null || university.longitude == null) continue;
        const { x, y } = projectLngLat(university.longitude, university.latitude);
        out.push({ x, y, university, cityCode: city.code });
      }
    }
    // Northernmost drawn first so southern pins overlap on top — the tip of a lower pin then
    // stays visible instead of being buried under its neighbour's head.
    return out.sort((a, b) => a.y - b.y);
  }, [cities]);

  if (Object.keys(PROVINCES).length === 0) return null;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={viewBox}
        aria-hidden="true"
        className={`mentor-tr-map h-full w-full touch-none ${isZoomed ? "cursor-grab" : ""}`}
        onMouseLeave={() => onHoverUniversity(null, null)}
        {...handlers}
      >
        {Object.entries(PROVINCES).map(([code, shape]) => (
          <path
            key={code}
            d={shape.d}
            data-selected={code === selectedCityCode || undefined}
            onClick={() => {
              onSelectCity(code);
              zoomToBox(shape.bbox);
            }}
          />
        ))}

        {placed.map((item) => {
          const active = item.university.id === activeUniversityId;
          const scale = unit * PIN_SCALE;
          return (
            <g
              key={item.university.id}
              className="mentor-tr-map-pin"
              transform={`translate(${item.x},${item.y}) scale(${scale})`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCity(item.cityCode);
                onSelectUniversity(item.university);
              }}
              onMouseEnter={(e) =>
                onHoverUniversity(
                  item.university,
                  (e.currentTarget as SVGGElement).getBoundingClientRect(),
                )
              }
            >
              <path
                d={PIN_PATH}
                fill={active ? "var(--color-accent)" : "var(--color-main)"}
                stroke="#fff"
                strokeWidth={1.2}
              />
              <circle cy={-13} r={3} fill="#fff" />
            </g>
          );
        })}
      </svg>

      {overlay && overlayVisible ? (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: `${overlayPos!.left}%`,
            top: `${overlayPos!.top}%`,
            // Anchor the bottom of the node on the city, so it stands on the province.
            transform: "translate(-50%, -100%)",
          }}
        >
          {overlay.node}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
        <p className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
          {t("attribution")}
        </p>
        <div className="pointer-events-auto flex flex-col gap-1">
          <ZoomButton label={t("zoom_in")} onClick={zoomIn}>
            +
          </ZoomButton>
          <ZoomButton label={t("zoom_out")} onClick={zoomOut}>
            −
          </ZoomButton>
          {isZoomed ? (
            <ZoomButton label={t("zoom_reset")} onClick={reset}>
              ⤢
            </ZoomButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-card)] border text-base font-bold shadow-[var(--shadow-card)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{
        borderColor: "var(--color-border, #e2e2e2)",
        backgroundColor: "var(--color-surface, #fff)",
        color: "var(--color-main)",
      }}
    >
      {children}
    </button>
  );
}

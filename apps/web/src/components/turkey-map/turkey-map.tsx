"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GEO_REGIONS, type CityDto, type GeoRegion } from "@mentor/types";
import { MAP_VIEWBOX, PROVINCES } from "./paths.generated";

/**
 * Province picker for the goal screen.
 *
 * Accessibility contract: the `<select>` is the selection control, always rendered and always
 * usable. The SVG is `aria-hidden` visual enhancement — putting 81 provinces into the tab order
 * would make the screen worse for keyboard and screen-reader users, not better. The same decision
 * means the screen degrades cleanly when the map data has not been generated yet: no drawing,
 * everything still works.
 *
 * Hover only previews; committing a choice always goes through `onSelect`. On touch there is no
 * hover, so tapping a province both previews and selects — no separate mobile code path.
 */
export function TurkeyMap({
  cities,
  selectedCode,
  onSelect,
  showUniversities,
  disabled = false,
}: {
  cities: CityDto[];
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
  /** University badges and the card's university list are YKS-only — noise for KPSS/LGS. */
  showUniversities: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("vision.map");
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const byCode = useMemo(
    () => new Map(cities.map((city) => [city.code, city])),
    [cities],
  );

  const grouped = useMemo(() => {
    const groups = new Map<GeoRegion, CityDto[]>();
    for (const region of GEO_REGIONS) groups.set(region, []);
    for (const city of cities) groups.get(city.region)?.push(city);
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    }
    return groups;
  }, [cities]);

  const hasMap = Object.keys(PROVINCES).length > 0;
  const shownCode = hoveredCode ?? selectedCode;
  const shown = shownCode ? (byCode.get(shownCode) ?? null) : null;

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_260px] lg:items-start lg:gap-4">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--color-main)" }}
          >
            {t("city_label")}
          </span>
          <select
            value={selectedCode ?? ""}
            disabled={disabled}
            onChange={(e) => onSelect(e.target.value || null)}
            className="min-h-[44px] w-full rounded-[var(--radius-card)] border px-3 text-base"
            style={{
              borderColor: "var(--color-border, #e2e2e2)",
              color: "var(--color-body)",
              backgroundColor: "var(--color-surface, #fff)",
            }}
          >
            <option value="">{t("city_placeholder")}</option>
            {GEO_REGIONS.map((region) => {
              const list = grouped.get(region) ?? [];
              if (list.length === 0) return null;
              return (
                <optgroup key={region} label={t(`region.${region}`)}>
                  {list.map((city) => (
                    <option key={city.code} value={city.code}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>

        {hasMap ? (
          <svg
            viewBox={MAP_VIEWBOX}
            aria-hidden="true"
            className="mentor-tr-map w-full"
            onMouseLeave={() => setHoveredCode(null)}
          >
            {Object.entries(PROVINCES).map(([code, shape]) => (
              <path
                key={code}
                d={shape.d}
                data-selected={code === selectedCode || undefined}
                onClick={() => !disabled && onSelect(code)}
                onMouseEnter={() => setHoveredCode(code)}
              />
            ))}

            {showUniversities &&
              cities.map((city) => {
                const shape = PROVINCES[city.code];
                if (!shape || city.universities.length === 0) return null;
                return (
                  // pointerEvents="none" is load-bearing: without it the badge swallows the click
                  // and the province underneath never gets selected.
                  <g
                    key={city.code}
                    transform={`translate(${shape.cx},${shape.cy})`}
                    pointerEvents="none"
                  >
                    <circle r="7.5" fill="var(--color-main)" />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fontSize="9"
                      fontWeight="700"
                      fill="#fff"
                    >
                      {city.universities.length}
                    </text>
                  </g>
                );
              })}

            {shown && PROVINCES[shown.code] ? (
              // Label lives inside the SVG, so it positions itself in the viewBox coordinate
              // system — no getBoundingClientRect maths, no edge-of-screen clamping.
              <text
                className="mentor-tr-map-label"
                x={PROVINCES[shown.code]!.cx}
                y={PROVINCES[shown.code]!.cy - 14}
                textAnchor="middle"
                pointerEvents="none"
              >
                {shown.name}
              </text>
            ) : null}
          </svg>
        ) : null}

        {hasMap ? (
          // ODbL requires attribution wherever the boundary data is shown. Kept inside the map
          // component rather than in a global footer so it appears with the map and only with it.
          <p className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
            {t("attribution")}
          </p>
        ) : null}
      </div>

      <CityCard city={shown} showUniversities={showUniversities} />
    </div>
  );
}

/**
 * Fixed panel beside the map rather than a tooltip chasing the cursor: a following tooltip needs
 * viewport-collision maths and means nothing on touch, for the same content.
 */
function CityCard({
  city,
  showUniversities,
}: {
  city: CityDto | null;
  showUniversities: boolean;
}) {
  const t = useTranslations("vision.map");

  return (
    <aside
      aria-live="polite"
      className="rounded-[var(--radius-card)] border p-3"
      style={{
        borderColor: "var(--color-border, #e2e2e2)",
        backgroundColor: "var(--color-surface, #fff)",
      }}
    >
      {!city ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("card_empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span
              className="text-base font-bold"
              style={{ color: "var(--color-main)" }}
            >
              {city.name}
            </span>
            <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {t(`region.${city.region}`)}
            </span>
          </div>

          {showUniversities ? (
            city.universities.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("no_universities")}
              </p>
            ) : (
              <>
                <span
                  className="text-xs font-semibold"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("university_count", { count: city.universities.length })}
                </span>
                <ul className="flex flex-col gap-1">
                  {city.universities.map((uni) => (
                    <li
                      key={uni.id}
                      className="text-sm"
                      style={{ color: "var(--color-body)" }}
                    >
                      {uni.name}
                      {uni.foundedYear ? (
                        <span
                          className="ml-1 text-xs"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          ({uni.foundedYear})
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : null}
        </div>
      )}
    </aside>
  );
}

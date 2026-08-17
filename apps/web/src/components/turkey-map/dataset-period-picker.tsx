"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { DatasetInfoDto } from "@mentor/types";
import {
  geoControllerListDatasets,
  type GeoControllerListDatasetsFamily,
} from "@mentor/api-client";
import { MenuSelect } from "@/components/menu-select";

function unwrap<T>(res: unknown): T | null {
  return ((res as { data?: T | null })?.data ?? (res as T | null)) as T | null;
}

/**
 * Published editions of the family's reference dataset, newest first.
 *
 * Loaded separately from the data itself so the picker can appear without waiting on ~18KB of
 * reference rows, and so switching periods re-fetches only what the period changes.
 */
export function useDatasets(family: string | null) {
  const [datasets, setDatasets] = useState<DatasetInfoDto[]>([]);
  // LGS has no reference dataset yet, so it asks for none rather than 404-ing on a family the
  // endpoint does not publish.
  const published =
    family === "KPSS" || family === "YKS"
      ? (family as GeoControllerListDatasetsFamily)
      : null;

  useEffect(() => {
    if (!published) return;
    let active = true;
    void geoControllerListDatasets({ family: published })
      .then((res) => {
        if (active) setDatasets(unwrap<DatasetInfoDto[]>(res) ?? []);
      })
      // No editions is a supported state — the picker simply does not render.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [published]);

  return datasets;
}

/**
 * Period selector for the map's reference data.
 *
 * Renders nothing for a single edition and a plain label for none: a dropdown that cannot drop
 * down is chrome pretending to be a control. It only becomes a menu once there is a real choice —
 * which is the moment a second placement round is imported.
 */
export function DatasetPeriodPicker({
  datasets,
  value,
  onChange,
}: {
  datasets: DatasetInfoDto[];
  /** `null` = whichever edition is current. */
  value: string | null;
  onChange: (datasetId: string | null) => void;
}) {
  const t = useTranslations("vision.dataset");
  if (datasets.length === 0) return null;

  const current = datasets.find((d) => d.isCurrent) ?? datasets[0]!;
  const selected = datasets.find((d) => d.id === value) ?? current;

  const chrome = {
    borderColor: "var(--color-border)",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-main)",
  } as const;

  if (datasets.length === 1) {
    return (
      <span
        className="flex min-h-9 items-center rounded-[var(--radius-card)] border px-3 text-xs font-semibold shadow-[var(--shadow-card)]"
        style={chrome}
      >
        {t("period", { period: selected.period })}
      </span>
    );
  }

  return (
    <div
      className="rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
      style={{ width: "11rem", backgroundColor: "var(--color-surface)" }}
    >
      <MenuSelect
        value={selected.id}
        aria-label={t("aria_label")}
        options={datasets.map((d) => ({
          value: d.id,
          // The current edition says so, so switching back is an obvious move rather than a guess.
          label: d.isCurrent
            ? t("period_current", { period: d.period })
            : t("period", { period: d.period }),
        }))}
        // Selecting the current edition stores `null`, so the URL/state stays on "whatever is
        // current" instead of pinning an id that stops being current next round.
        onChange={(next) => onChange(next === current.id ? null : next)}
      />
    </div>
  );
}

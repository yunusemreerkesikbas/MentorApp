"use client";

import { BadgeCheck, Check, ChevronDown, Sparkles } from "lucide-react";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CoachPlanAdaptationDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { CoachEvidenceList } from "@/components/coach-evidence-list";
import { FormError } from "@/components/form";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import { PremiumBadge } from "@/components/premium/premium-badge";
import {
  flattenPlanAdaptationChanges,
  selectedPlanAdaptationChanges,
  type PlanAdaptationRow,
} from "@/lib/plan-coach-adaptation-utils";

export interface PlanCoachAdaptationPreviewHandle {
  getSelectedChanges: () => CoachPlanAdaptationDto["changes"];
  setError: (message: string, stale?: boolean) => void;
}

interface PreviewProps {
  preview: CoachPlanAdaptationDto;
  onRegenerate: () => void;
}

export const PlanCoachAdaptationPreview = forwardRef<
  PlanCoachAdaptationPreviewHandle,
  PreviewProps
>(function PlanCoachAdaptationPreview({ preview, onRegenerate }, ref) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const rows = useMemo(
    () => flattenPlanAdaptationChanges(preview.changes),
    [preview.changes],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rows.map((row) => row.key)),
  );
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const rowsByDate = useMemo(() => {
    const grouped = new Map<string, PlanAdaptationRow[]>();
    for (const row of rows) {
      const day = grouped.get(row.date) ?? [];
      day.push(row);
      grouped.set(row.date, day);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [locale],
  );
  const formatDate = (date: string) =>
    dateFormatter.format(new Date(`${date}T12:00:00`));
  const evidence = preview.usedEvidence ?? [];

  useImperativeHandle(ref, () => ({
    getSelectedChanges: () => selectedPlanAdaptationChanges(rows, selected),
    setError: (message, isStale = false) => {
      setError(message);
      setStale(isStale);
    },
  }));

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (error && !stale) setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {preview.coachNote || preview.groundingLine ? (
        <CompanionBubble puhu="encouraging" text={preview.coachNote ?? preview.groundingLine!} />
      ) : null}
      {preview.coachNote && preview.groundingLine ? (
        <p className="text-xs text-[var(--color-secondary)]">{preview.groundingLine}</p>
      ) : null}
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {preview.message}
      </p>
      {evidence.length > 0 ? (
        <details className="group text-sm text-[var(--color-secondary-text)]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] [&::-webkit-details-marker]:hidden">
            <BadgeCheck
              className="size-4 shrink-0 text-[var(--color-accent)]"
              aria-hidden
            />
            <span className="font-semibold text-[var(--color-body-text)]">
              {t("coach_adaptation_evidence_title")}
            </span>
            <PremiumBadge className="ml-auto" />
            <ChevronDown
              className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          <div className="pb-1 pl-6">
            <CoachEvidenceList evidence={evidence} />
          </div>
        </details>
      ) : null}
      <FormError message={error} />
      {stale ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onRegenerate}
          fullWidth
        >
          <Sparkles size={17} aria-hidden />
          {t("coach_adaptation_regenerate")}
        </Button>
      ) : null}
      {rowsByDate.map(([date, dayRows]) => (
        <section key={date} aria-labelledby={`coach-adaptation-${date}`}>
          <h3
            id={`coach-adaptation-${date}`}
            className="mb-2 text-sm font-bold capitalize"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {formatDate(date)}
          </h3>
          <div className="flex flex-col gap-2">
            {dayRows.map((row) => (
              <label
                key={row.key}
                // The card's edge follows the box, so a skipped change reads at a glance.
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border border-[var(--play-line)] bg-[var(--color-surface-translucent)] px-3 py-2.5 transition-colors duration-150 has-[:checked]:border-[var(--play-cta)] motion-reduce:transition-none"
              >
                {/* Same box as the paywall consent, in the CTA's blue rather than the native black. */}
                <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
                  <input
                    type="checkbox"
                    checked={selected.has(row.key)}
                    onChange={() => toggle(row.key)}
                    className="peer size-5 cursor-pointer appearance-none rounded-md border-2 border-[var(--color-secondary)] transition-colors duration-150 checked:border-[var(--play-cta-edge)] checked:bg-[var(--play-cta)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none"
                  />
                  <Check
                    className="pointer-events-none absolute size-3.5 text-[var(--play-cta-ink)] opacity-0 peer-checked:opacity-100"
                    strokeWidth={3}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-sm font-semibold"
                    style={{ color: "var(--color-body)" }}
                  >
                    {row.change.title}
                  </span>
                  {row.change.kind === "ADD" && row.change.durationMinutes != null ? (
                    <span className="mt-0.5 block text-xs font-semibold text-[var(--color-secondary)]">
                      {t("duration_minutes", { minutes: row.change.durationMinutes })}
                    </span>
                  ) : null}
                  {row.change.kind === "MOVE" ? (
                    <span
                      className="mt-0.5 block text-xs"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {t("coach_adaptation_move_dates", {
                        from: formatDate(row.change.fromDate),
                        to: formatDate(row.change.toDate),
                      })}
                    </span>
                  ) : null}
                  {row.change.subject ? (
                    <span
                      className="mt-0.5 block text-xs"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {row.change.subject}
                    </span>
                  ) : null}
                  {row.change.reason ? (
                    <span className="mt-1 block text-xs font-medium text-[var(--color-secondary)]">
                      {t("coach_adaptation_reason", { reason: row.change.reason })}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
      {rows.length > 0 ? (
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-secondary)" }}
          aria-live="polite"
        >
          {t("coach_adaptation_selected_count", { count: selected.size })}
        </p>
      ) : null}
    </div>
  );
});

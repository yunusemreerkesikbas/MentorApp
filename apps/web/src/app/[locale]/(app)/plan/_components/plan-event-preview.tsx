"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PlanCalendarItem } from "@/lib/plan-calendar-item";
import {
  formatDateLabel,
  formatTimeRange,
  type PlanCalendarCopyNamespace,
} from "./plan-utils";

export interface PlanEventPreviewState<T> {
  item: PlanCalendarItem<T>;
  rect: DOMRect;
}

const CARD_WIDTH = 260;
const GAP = 8;

/**
 * Hover/focus preview for a calendar item. One instance per calendar surface, positioned from
 * the anchor's bounding rect — read-only, so it needs no focus management: pointer users read it,
 * keyboard users get it on focus, Esc dismisses, and clicking the chip is what opens the detail.
 */
export function usePlanEventPreview<T>() {
  const [preview, setPreview] = useState<PlanEventPreviewState<T> | null>(null);

  const onHover = useCallback(
    (item: PlanCalendarItem<T>, anchor: HTMLElement | null) => {
      setPreview(anchor ? { item, rect: anchor.getBoundingClientRect() } : null);
    },
    [],
  );

  useEffect(() => {
    if (!preview) return;
    const dismiss = () => setPreview(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    // A scroll moves the anchor out from under the card — drop it rather than chase it.
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [preview]);

  return { preview, onHover };
}

export function PlanEventPreview<T>({
  preview,
  namespace = "plan",
}: {
  preview: PlanEventPreviewState<T> | null;
  namespace?: PlanCalendarCopyNamespace;
}) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  if (!preview) return null;

  const { item, rect } = preview;
  const range = formatTimeRange(item.startTime, item.endTime);

  // Flip to the left / above when the card would leave the viewport.
  const left = Math.max(
    GAP,
    Math.min(rect.left, window.innerWidth - CARD_WIDTH - GAP),
  );
  const below = rect.bottom + GAP;
  const fitsBelow = below + 180 < window.innerHeight;
  const top = fitsBelow ? below : Math.max(GAP, rect.top - GAP - 180);

  return (
    <div
      role="tooltip"
      aria-live="polite"
      className="pointer-events-none fixed z-[60] flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
      style={{ left, top, width: CARD_WIDTH }}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-1 h-3 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: item.color.bar }}
        />
        <p
          className="min-w-0 text-sm font-bold leading-snug"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {item.title}
        </p>
      </div>

      <dl className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-secondary)" }}>
        <div className="flex gap-1.5">
          <dt className="sr-only">{t("calendar_preview_when")}</dt>
          <dd>
            {formatDateLabel(item.date, locale, t("today"), { alwaysFull: true })}
            {range ? ` · ${range}` : ` · ${t("all_day")}`}
          </dd>
        </div>
        {item.meta ? (
          <div className="flex gap-1.5">
            <dt className="sr-only">{t("calendar_preview_meta")}</dt>
            <dd>{item.meta}</dd>
          </div>
        ) : null}
      </dl>

      {item.description ? (
        <p
          className="line-clamp-4 text-xs leading-relaxed"
          style={{ color: "var(--color-body)" }}
        >
          {item.description}
        </p>
      ) : null}

      {item.hint ? (
        <p className="text-[11px]" style={{ color: "var(--color-secondary)" }}>
          {item.hint}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { SlidingTabs, type SlidingTabItem } from "@mentor/ui";

export interface SegmentPillItem {
  id: string;
  label: ReactNode;
  /** Associated tabpanel id for aria-controls. */
  panelId?: string;
}

export interface SegmentPillControlProps {
  items: SegmentPillItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /**
   * @deprecated Kept for call-site compatibility. SlidingTabs no longer uses Framer layoutId.
   */
  layoutId?: string;
  /** Stretch tabs equally across the track (Analysis). */
  equalWidth?: boolean;
  /** Prefix for tab button ids: `{idPrefix}-{item.id}`. */
  idPrefix?: string;
  className?: string;
}

/**
 * Sliding pill segment control — shared CSS tabs (transitions.dev), reusable across app surfaces.
 */
export function SegmentPillControl({
  items,
  value,
  onChange,
  ariaLabel,
  equalWidth = false,
  idPrefix,
  className = "",
}: SegmentPillControlProps) {
  const tabs: SlidingTabItem[] = items.map((item) => ({
    id: item.id,
    label: item.label,
    panelId: item.panelId,
  }));

  return (
    <SlidingTabs
      items={tabs}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      equalWidth={equalWidth}
      idPrefix={idPrefix}
      className={[equalWidth ? "w-full" : "self-start", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

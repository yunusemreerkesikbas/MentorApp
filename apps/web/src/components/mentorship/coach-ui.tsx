"use client";

import { useId, type ReactNode } from "react";

/**
 * Grouped inset sections for the coach workspace. They read Nuton tokens (`@mentor/ui`);
 * the tighter type scale is `.coach-*` in `(coach)/_components/coach-theme.css`.
 *
 * Fields, menus, date pickers and buttons are the app's shared components (`@mentor/ui`,
 * `MenuSelect`, `DateField`), the same ones the coach calendar uses; only the grouping lives here.
 */

export const INSET_GROUP_CLASS =
  "overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

/** Light `--color-border` is white; surface-container is the visible hairline on a white card. */
export const INSET_DIVIDE_CLASS = "divide-y divide-[var(--color-surface-container)]";

/** One row of an inset group. Put `INSET_DIVIDE_CLASS` on the group. */
export const INSET_ROW_CLASS = "flex min-h-11 items-center justify-between gap-3 px-4 py-2.5";

/** A small grey heading inside a section or panel ("Hızlı başlangıç", "Silinen ödevler"). */
export const SUBHEAD_CLASS = "coach-footnote px-1 font-semibold text-[var(--color-secondary)]";

/** The quiet explanatory line under a block. */
export const NOTE_CLASS = "coach-footnote px-1 text-[var(--color-secondary)]";

export function InsetSection({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`flex min-w-0 flex-col gap-2.5 ${className ?? ""}`}>
      <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 id={headingId} className="coach-headline text-[var(--color-main)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

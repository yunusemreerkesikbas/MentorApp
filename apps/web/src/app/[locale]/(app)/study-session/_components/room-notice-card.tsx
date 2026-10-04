"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";

/**
 * A table's one-card moments: arriving by invite, a code that no longer works, a table that is
 * gone. Puhu leans over the card's top edge, one sentence says what happened, and the actions
 * say what to do next, so no path ends on a bare line of text.
 *
 * Focus goes to the title whenever it changes (joining → a failure, loading → not found), so a
 * screen reader hears the new state instead of nothing.
 */
export function RoomNoticeCard({
  puhu,
  title,
  body,
  children,
}: {
  puhu: PuhuVariant;
  title: string;
  body?: ReactNode;
  /** Actions or a progress line, stacked full width under the words. */
  children?: ReactNode;
}) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, [title]);
  return (
    <section
      aria-labelledby={titleId}
      className="relative mx-auto mt-20 flex w-full max-w-[26rem] flex-col items-center gap-2.5 rounded-[var(--play-radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-6 pt-14 text-center shadow-[var(--shadow-card)]"
    >
      <span className="absolute -top-16 left-1/2 -translate-x-1/2">
        <PuhuImage variant={puhu} size={112} priority />
      </span>
      <h1
        ref={titleRef}
        id={titleId}
        tabIndex={-1}
        className="text-balance outline-none text-xl font-extrabold leading-snug text-[var(--color-main)]">
        {title}
      </h1>
      {body ? (
        <p className="text-pretty text-body-sm font-semibold text-[var(--color-secondary)]">{body}</p>
      ) : null}
      {children ? <div className="mt-3 flex w-full flex-col items-center gap-1">{children}</div> : null}
    </section>
  );
}

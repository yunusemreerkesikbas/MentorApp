"use client";

import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Building blocks of the coach workspace look: grouped inset sections, fill fields, text buttons.
 * They read the `.coach-theme` tokens (see `(coach)/_components/coach-theme.css`), so they only look
 * right under the coach shell.
 *
 * Local rather than `@mentor/ui` variants: the shared primitives are sized and filled for the
 * student app (translucent field, 50px call to action), and this look belongs to one route group.
 */

export const INSET_GROUP_CLASS =
  "overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)]";

/** One row of an inset group. Put `divide-y divide-[var(--color-border)]` on the group. */
export const INSET_ROW_CLASS = "flex min-h-11 items-center justify-between gap-3 px-4 py-2.5";

export const COACH_FIELD_CLASS =
  "coach-body min-h-11 w-full rounded-[var(--radius-card)] border border-transparent bg-[var(--color-surface-container)] px-3.5 py-2.5 text-[var(--color-main)] outline-none placeholder:text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";

/** Scrolling content of a coach panel. */
export const PANEL_BODY_CLASS = "flex flex-col gap-5 px-5 pb-6 pt-1";

/**
 * Sticky action bar at the bottom of a coach panel; lives inside the form it submits. No
 * `justify-*` here, so each caller picks one without two utilities fighting over it.
 */
export const PANEL_FOOTER_CLASS =
  "sticky bottom-0 mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-5 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3.5";

/** A small grey heading inside a section or panel ("Hızlı başlangıç", "Silinen ödevler"). */
export const SUBHEAD_CLASS = "coach-footnote px-1 font-semibold text-[var(--color-secondary)]";

/** The quiet explanatory line under a block. */
export const NOTE_CLASS = "coach-footnote px-1 text-[var(--color-secondary)]";

const LABEL_CLASS = "coach-footnote font-semibold text-[var(--color-secondary)]";
const HINT_CLASS = "coach-footnote text-[var(--color-secondary)]";

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

type TextButtonTone = "accent" | "muted" | "danger";

const TONE_CLASS: Record<TextButtonTone, string> = {
  accent: "text-[var(--coach-accent-text)]",
  muted: "text-[var(--color-secondary)]",
  danger: "text-[var(--color-danger)]",
};

/** A borderless, fill-less action: the HIG "plain" button. 44px tall like every other target. */
export function TextButton({
  tone = "accent",
  type = "button",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: TextButtonTone }) {
  return (
    <button
      type={type}
      {...rest}
      className={`coach-body inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-card)] px-2 font-semibold outline-none transition-opacity duration-150 hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${TONE_CLASS[tone]} ${className ?? ""}`}
    />
  );
}

export function CoachTextField({
  label,
  hint,
  id,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={inputId} className={LABEL_CLASS}>
        {label}
      </label>
      <input {...rest} id={inputId} aria-describedby={hintId} className={COACH_FIELD_CLASS} />
      {hint ? (
        <p id={hintId} className={HINT_CLASS}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CoachTextArea({
  label,
  hint,
  id,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={inputId} className={LABEL_CLASS}>
        {label}
      </label>
      <textarea
        {...rest}
        id={inputId}
        aria-describedby={hintId}
        className={`${COACH_FIELD_CLASS} resize-y`}
      />
      {hint ? (
        <p id={hintId} className={HINT_CLASS}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

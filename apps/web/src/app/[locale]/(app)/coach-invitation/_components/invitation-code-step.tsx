"use client";

import { useEffect, useId, useRef } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import { PANEL_CARD } from "@/components/panel/panel-styles";

/**
 * Step one: Puhu says what happens next, then the code. A refused code is answered under the field
 * it came from (`aria-invalid` + the API's own sentence), not in a toast that leaves before a
 * phone finishes showing it.
 */
export function InvitationCodeStep({
  code,
  error,
  busy,
  focusOnMount,
  onChange,
  onSubmit,
}: {
  code: string;
  error: string | null;
  busy: boolean;
  /** Back from the preview ("Değiştir", "Vazgeç"): the pressed control is gone, the field takes focus. */
  focusOnMount: boolean;
  onChange: (code: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("mentorship");
  const fieldId = useId();
  const errorId = useId();
  const helpId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusOnMount) fieldRef.current?.focus();
  }, [focusOnMount]);

  return (
    <>
      <CompanionBubble puhu="encouraging" text={t("invitation_puhu")} />
      <form
        className={`${PANEL_CARD} flex flex-col gap-2.5`}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor={fieldId} className="text-sm font-extrabold text-[var(--color-main)]">
          {t("invitation_code_label")}
        </label>
        <input
          id={fieldId}
          ref={fieldRef}
          value={code}
          placeholder={t("invitation_code_placeholder")}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${helpId}` : helpId}
          onChange={(event) => onChange(event.target.value)}
          className={`h-14 w-full rounded-[var(--radius-card)] border-[1.5px] bg-[var(--color-surface)] px-4 font-mono text-base font-bold tracking-wider text-[var(--color-main)] outline-none placeholder:font-semibold placeholder:text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${error ? "border-[var(--color-danger)] ring-3 ring-[var(--color-error-container)]" : "border-[var(--play-line)]"}`}
        />
        {error ? (
          <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-bold text-[var(--color-danger)]">
            <CircleAlert aria-hidden className="mt-px size-4.5 shrink-0" strokeWidth={1.75} />
            {error}
          </p>
        ) : null}
        <p id={helpId} className="text-caption font-semibold text-[var(--color-secondary)]">
          {t("invitation_code_help")}
        </p>
        <div className="pt-1.5">
          <Button type="submit" busy={busy} disabled={code.trim() === ""}>
            {t("invitation_check")}
          </Button>
        </div>
      </form>
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { LEDGE } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { SignupTurnstile, turnstileSiteKey } from "@/app/[locale]/(auth)/_components/signup-turnstile";

export type WaitlistStatus = "idle" | "sending" | "success" | "error" | "network";

const PROMPT = "text-center text-body-sm text-[var(--landing-on-night-soft)]";
const TEXT_ACTION =
  "inline-flex min-h-11 cursor-pointer items-center font-extrabold text-[var(--landing-lamp)] underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";
/** The ledge's ring sits on the card, not on white. */
const RING_ON_CARD = "focus-visible:ring-offset-[var(--lw-card)]";

/** The address step. The kit Modal owns the `<form>`; this is its body. */
export function WaitlistFields({
  status,
  email,
  onEmail,
  inputRef,
  turnstileToken,
  onTurnstileToken,
  turnstileResetKey,
  onLogin,
}: {
  status: WaitlistStatus;
  email: string;
  onEmail: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  turnstileToken: string | null;
  onTurnstileToken: (token: string | null) => void;
  turnstileResetKey: number;
  onLogin: () => void;
}) {
  const t = useTranslations("waitlist.idle");
  const invalid = status === "error";
  const message = invalid ? t("error") : status === "network" ? t("network") : null;
  const sending = status === "sending";

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <label htmlFor="waitlist-email" className="text-sm font-extrabold text-[var(--landing-on-night)]">
          {t("label")}
        </label>
        {/*
          `type="text"` + `inputMode="email"`: the Modal's form validates natively otherwise, and the
          copy's own hint should be the one the student reads. The placeholder reads
          `--color-secondary` (global `::placeholder`), so the field re-points it for white.
        */}
        <input
          ref={inputRef}
          id="waitlist-email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("placeholder")}
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={message ? "waitlist-email-error" : undefined}
          className={`h-14 rounded-[var(--play-radius)] border-2 bg-[var(--landing-on-night)] px-4 text-lg font-bold text-[var(--lw-field-ink)] outline-none [--color-secondary:var(--lw-field-placeholder)] focus:outline-3 focus:outline-solid focus:outline-offset-2 focus:outline-[var(--color-focus-ring)] ${
            invalid ? "border-[var(--lw-error-line)]" : "border-[var(--landing-on-night)]"
          }`}
        />
        {message ? (
          <p id="waitlist-email-error" role="alert" className="text-sm font-bold text-[var(--lw-error)]">
            {message}
          </p>
        ) : null}
        <SignupTurnstile action="waitlist" onToken={onTurnstileToken} resetKey={turnstileResetKey} />
        <button
          type="submit"
          disabled={sending || Boolean(turnstileSiteKey && !turnstileToken)}
          aria-busy={sending}
          className={`${LEDGE} ${RING_ON_CARD} mt-1.5 w-full cursor-pointer bg-[var(--landing-lamp)] text-[var(--lw-field-ink)] shadow-[0_4px_0_var(--lw-lamp-edge)] disabled:cursor-wait disabled:opacity-80`}
        >
          {t("submit")}
        </button>
      </div>
      <p className={PROMPT}>
        {t("login_prompt")}{" "}
        <Link href="/login" onClick={onLogin} className={TEXT_ACTION}>
          {t("login")}
        </Link>
      </p>
    </>
  );
}

/**
 * One line under the title for both steps. It stays mounted while its text changes, so the polite
 * live region announces the success line (a region mounted with its text is often not read).
 */
export function WaitlistLede({ success, email }: { success: boolean; email: string }) {
  const t = useTranslations("waitlist");

  return (
    <p aria-live="polite" className="text-base leading-normal text-[var(--landing-on-night-soft)]">
      {success
        ? t.rich("success.body", {
            email,
            b: (chunks) => <b className="break-all font-bold text-[var(--landing-on-night)]">{chunks}</b>,
          })
        : t("idle.body")}
    </p>
  );
}

/** The address is in. "Düzelt" goes back to the field with the address kept. */
export function WaitlistDone({
  doneRef,
  onDone,
  onEdit,
}: {
  doneRef: RefObject<HTMLButtonElement | null>;
  onDone: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("waitlist.success");

  return (
    <>
      <button
        ref={doneRef}
        type="button"
        onClick={onDone}
        className={`${LEDGE} ${RING_ON_CARD} w-full cursor-pointer border-2 border-[var(--landing-on-night-line)] bg-transparent text-[var(--landing-on-night)]`}
      >
        {t("done")}
      </button>
      <p className={PROMPT}>
        {t("edit_prompt")}{" "}
        <button type="button" onClick={onEdit} className={TEXT_ACTION}>
          {t("edit")}
        </button>
      </p>
    </>
  );
}

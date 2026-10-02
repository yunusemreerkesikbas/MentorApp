"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PhoneStatusDto, PhoneVerificationDto } from "@mentor/types";
import {
  ApiClientError,
  phoneControllerConfirmVerification,
  phoneControllerGetStatus,
  phoneControllerRequestVerification,
} from "@mentor/api-client";
import { phoneVerificationConfirmSchema, phoneVerificationRequestSchema } from "@mentor/validation";
import { Button, Card, Skeleton, SkeletonGroup, TextField } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { SignupTurnstile, turnstileSiteKey } from "@/app/[locale]/(auth)/_components/signup-turnstile";

interface PhoneVerificationCardProps {
  allowNumberChange?: boolean;
  onStatusChange?: (status: PhoneStatusDto) => void;
}

/** The same private verification form serves registration, trial and account settings. */
export function PhoneVerificationCard({ allowNumberChange = false, onStatusChange }: PhoneVerificationCardProps) {
  const t = useTranslations("phone");
  const common = useTranslations("common");
  const locale = useLocale();
  const titleId = useId();
  const [status, setStatus] = useState<PhoneStatusDto | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<PhoneVerificationDto | null>(null);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [loadKey, setLoadKey] = useState(0);
  const [now, setNow] = useState(0);
  const callback = useRef(onStatusChange);
  useEffect(() => { callback.current = onStatusChange; }, [onStatusChange]);

  useEffect(() => {
    let active = true;
    phoneControllerGetStatus()
      .then((response) => {
        if (!active) return;
        const next = response as unknown as PhoneStatusDto;
        setStatus(next);
        callback.current?.(next);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiClientError ? err.message : common("error_unknown"));
      });
    return () => { active = false; };
  }, [common, loadKey]);

  // Wake at the two server deadlines; there is no ticking countdown or client rate-limit rule.
  useEffect(() => {
    if (!challenge) return;
    const timers = [challenge.resendAvailableAt, challenge.expiresAt].map((deadline) =>
      window.setTimeout(() => setNow(Date.now()), Math.max(0, Date.parse(deadline) - Date.now())),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [challenge]);

  function showFailure(err: unknown) {
    setError(err instanceof ApiClientError ? err.message : common("error_unknown"));
    if (err instanceof ApiClientError && err.body.code === "AUTH_PHONE_REAUTHENTICATION_REQUIRED") {
      setStatus((current) => current ? { ...current, reauthenticationRequired: true } : current);
    }
    if (err instanceof ApiClientError && err.body.code === "AUTH_PHONE_DISABLED") {
      setStatus((current) => current ? { ...current, available: false } : current);
    }
  }

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    setBusy(true);
    const input = { phoneNumber, ...(token ? { turnstileToken: token } : {}) };
    const parsed = phoneVerificationRequestSchema.safeParse(input);
    try {
      // Invalid input still reaches the boundary to get the API's localized validation message.
      const next = await phoneControllerRequestVerification(parsed.success ? parsed.data : input) as unknown as PhoneVerificationDto;
      setChallenge(next);
      setCode("");
      setNow(Date.now());
    } catch (err) {
      showFailure(err);
    } finally {
      setBusy(false);
      setToken(null);
      setResetKey((value) => value + 1);
    }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    setBusy(true);
    const parsed = phoneVerificationConfirmSchema.safeParse({ code });
    try {
      const next = await phoneControllerConfirmVerification(challenge.challengeId, parsed.success ? parsed.data : { code }) as unknown as PhoneStatusDto;
      setStatus(next);
      setChanging(false);
      setChallenge(null);
      setPhoneNumber("");
      setCode("");
      callback.current?.(next);
    } catch (err) {
      showFailure(err);
    } finally {
      setBusy(false);
    }
  }

  const expired = challenge !== null && now >= Date.parse(challenge.expiresAt);
  const resendReady = challenge !== null && now >= Date.parse(challenge.resendAvailableAt);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const tokenMissing = Boolean(turnstileSiteKey && !token);

  return (
    <Card className="flex flex-col gap-4" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-base font-extrabold text-[var(--color-main)]">{t("title")}</h2>
      <FormError message={error} />
      {status === null ? error ? (
        <Button variant="secondary" onClick={() => { setError(null); setLoadKey((key) => key + 1); }}>{t("retry")}</Button>
      ) : (
        <SkeletonGroup label={t("loading")}>
          <Skeleton className="h-4 w-48 rounded-[var(--radius-card)]" />
          <Skeleton className="mt-3 h-12 rounded-[var(--radius-card)]" />
        </SkeletonGroup>
      ) : status.verified && !changing ? (
        <>
          <p role="status" className="text-sm text-[var(--color-body)]">{t("verified", { number: status.maskedPhoneNumber ?? "" })}</p>
          {allowNumberChange ? <Button variant="secondary" disabled={!status.available} onClick={() => setChanging(true)}>{t("change")}</Button> : null}
          {!status.available ? <p role="status" className="text-sm text-[var(--color-secondary)]">{t("unavailable")}</p> : null}
        </>
      ) : !status.available ? (
        <p role="status" className="text-sm text-[var(--color-secondary)]">{t("unavailable")}</p>
      ) : status.reauthenticationRequired ? (
        <>
          <p className="text-sm text-[var(--color-secondary)]">{t("reauthentication")}</p>
          <Link href={{ pathname: "/login", query: { next: "/settings?section=phone" } }} className="flex min-h-11 items-center font-extrabold text-[var(--color-main)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">{t("sign_in_again")}</Link>
        </>
      ) : (
        <>
          <p className="text-sm text-[var(--color-secondary)]">{t(changing ? "change_hint" : "hint")}</p>
          {challenge ? (
            <>
              <p role="status" className="text-sm text-[var(--color-body)]">{t(challenge.sendStatus === "SENT" ? "sent" : "send_unknown", { number: challenge.maskedPhoneNumber })}</p>
              <form onSubmit={(event) => void confirmCode(event)} className="flex flex-col gap-3">
                <TextField label={t("code")} name="phoneCode" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} pattern="[0-9]{6}" maxLength={6} required disabled={busy || expired} autoFocus />
                <p role="status" className="text-caption text-[var(--color-secondary)]">{expired ? t("expired") : t("expires", { time: time(challenge.expiresAt) })}</p>
                <Button type="submit" busy={busy} disabled={expired}>{t("confirm")}</Button>
              </form>
              <SignupTurnstile action="phone-verification" onToken={setToken} resetKey={resetKey} />
              {!resendReady ? <p className="text-caption text-[var(--color-secondary)]">{t("resend_at", { time: time(challenge.resendAvailableAt) })}</p> : null}
              <Button variant="secondary" disabled={busy || !resendReady || tokenMissing} onClick={() => void requestCode()}>{t("resend")}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => { setChallenge(null); setCode(""); setError(null); }}>{t("edit_number")}</Button>
            </>
          ) : (
            <form onSubmit={(event) => void requestCode(event)} className="flex flex-col gap-3">
              <TextField label={t("number")} name="phoneNumber" type="tel" autoComplete="tel" placeholder={t("placeholder")} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} maxLength={32} required disabled={busy} />
              <SignupTurnstile action="phone-verification" onToken={setToken} resetKey={resetKey} />
              <Button type="submit" busy={busy} disabled={tokenMissing}>{t("send")}</Button>
            </form>
          )}
        </>
      )}
    </Card>
  );
}

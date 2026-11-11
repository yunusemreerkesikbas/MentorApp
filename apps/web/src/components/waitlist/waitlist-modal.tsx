"use client";

import "./waitlist.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError, authControllerJoinWaitlist } from "@mentor/api-client";
import { Modal } from "@mentor/ui";
import { turnstileSiteKey } from "@/app/[locale]/(auth)/_components/signup-turnstile";
import { trackProductEvent } from "@/lib/analytics";
import { isWaitlistEmail } from "@/lib/signup-waitlist";
import { WaitlistBanner } from "./waitlist-banner";
import { WaitlistDone, WaitlistFields, WaitlistLede, type WaitlistStatus } from "./waitlist-steps";

export interface WaitlistModalProps {
  role: "student" | "coach";
  onClose: () => void;
  /**
   * "Giriş yap" already navigates; this runs on its click. Defaults to `onClose`. A page whose
   * `onClose` navigates too (the signup page sends the student home) passes its own, or the two
   * navigations race and the later one wins.
   */
  onLogin?: () => void;
}

/**
 * "Çok yakında": the student or coach leaves an address while signup is invite-only. The API
 * answers every valid request the same way, so the card only ever says "you're on the list".
 *
 * Portalled to `document.body` inside its own token scope (`waitlist.css`): the landing remaps
 * `--color-*` per section, and the card must look the same from every page that opens it.
 */
export function WaitlistModal({ role, onClose, onLogin = onClose }: WaitlistModalProps) {
  const t = useTranslations("waitlist");
  const locale = useLocale() === "en" ? "en" : "tr";
  const [status, setStatus] = useState<WaitlistStatus>("idle");
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const success = status === "success";

  // The step's controls replace each other, so focus follows: "Tamam" on success, the field on "Düzelt".
  useEffect(() => {
    (success ? doneRef : inputRef).current?.focus();
  }, [success]);

  // The page behind should not scroll under the thumb filling the card in (same as RoomSheet).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function onEmail(value: string) {
    setEmail(value);
    if (status === "error" || status === "network") setStatus("idle");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React bubbles events along the component tree, portals included: opened from inside another
    // form (the login page's "Hesap oluştur"), this submit would also submit that form.
    event.stopPropagation();
    if (status === "sending" || success) return;
    if (!isWaitlistEmail(email)) {
      setStatus("error");
      inputRef.current?.focus();
      return;
    }
    if (turnstileSiteKey && !turnstileToken) return;
    setStatus("sending");
    try {
      await authControllerJoinWaitlist({
        email: email.trim(),
        role,
        locale,
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      setStatus("success");
      trackProductEvent("generate_lead", { lead_source: "waitlist", intent: role });
    } catch (error) {
      // Only the server's own address check is the student's to fix; anything else is on us.
      const badAddress = error instanceof ApiClientError && error.body.code === "VALIDATION_ERROR";
      setStatus(badAddress ? "error" : "network");
    } finally {
      setTurnstileToken(null);
      setTurnstileResetKey((value) => value + 1);
    }
  }

  // "Tamam" leaves the way the X and Escape do: the kit Modal animates out on `cancel`.
  function closeLikeEscape() {
    doneRef.current?.closest("dialog")?.dispatchEvent(new Event("cancel", { cancelable: true }));
  }

  return createPortal(
    <div className="landing-city-theme waitlist-theme">
      <Modal
        title={t(success ? "success.title" : "idle.title")}
        closeLabel={t("close")}
        onClose={onClose}
        closeDisabled={status === "sending"}
        initialFocusRef={inputRef}
        onSubmit={onSubmit}
        placement="sheet"
        className="lw-card"
        banner={<WaitlistBanner success={success} badge={t(success ? "success.badge" : "idle.badge")} />}
      >
        <WaitlistLede success={success} email={email.trim()} />
        {success ? (
          <WaitlistDone doneRef={doneRef} onDone={closeLikeEscape} onEdit={() => setStatus("idle")} />
        ) : (
          <WaitlistFields
            status={status}
            email={email}
            onEmail={onEmail}
            inputRef={inputRef}
            turnstileToken={turnstileToken}
            onTurnstileToken={setTurnstileToken}
            turnstileResetKey={turnstileResetKey}
            onLogin={onLogin}
          />
        )}
      </Modal>
    </div>,
    document.body,
  );
}

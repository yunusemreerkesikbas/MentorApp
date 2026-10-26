"use client";

import { useId, useState, type FormEvent } from "react";
import { GiftIcon as Gift } from "@solar-icons/react/bold/gift";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type { InviteCodeView } from "@mentor/types";
import { redeemInviteSchema } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { FormError } from "@/components/form";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { notifyEconomyChanged, redeemInviteCode } from "@/lib/economy";

/** Anchor on the phone card in Ayarlar (`profile-shell.tsx`). */
const PHONE_CARD_ANCHOR = "phone-verification";

interface InviteRedeemPanelProps {
  redeemed: InviteCodeView["redeemed"];
  canRedeem: boolean;
  /** Reload the card view after a code was accepted. */
  onRedeemed: () => void;
  /** The phone link leaves the dialog: close it so the page behind is the one that scrolls. */
  onLeave: () => void;
  reduceMotion: boolean | null;
}

/**
 * The bottom dock of the invite card. Three honest states: a form while the viewer can still use a
 * friend's code, the result once they did, and nothing at all when they can no longer redeem
 * (paid already, or the sign-up window closed). The disclosure sits above the field because the
 * code tells the inviter who joined and later who went Premium.
 */
export function InviteRedeemPanel({
  redeemed,
  canRedeem,
  onRedeemed,
  onLeave,
  reduceMotion,
}: InviteRedeemPanelProps) {
  const t = useTranslations("economy");
  const locale = useLocale();
  const inputId = useId();
  const disclosureId = useId();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleRedeem(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = redeemInviteSchema.safeParse({ code: input });
    if (!parsed.success) {
      setError(t("redeem_invalid"));
      return;
    }
    setBusy(true);
    try {
      await redeemInviteCode(parsed.data.code);
      setInput("");
      setSaved(true);
      notifyEconomyChanged();
      onRedeemed();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("redeem_failed"));
    } finally {
      setBusy(false);
    }
  }

  if (!redeemed && !canRedeem && !saved) return null;

  const phoneHref = `${getPathname({ href: "/settings", locale: locale as Locale })}#${PHONE_CARD_ANCHOR}`;

  return (
    <motion.div
      className="relative z-[1] w-full shrink-0 rounded-t-[24px] bg-[var(--color-surface)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:pb-5"
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.35,
        delay: reduceMotion ? 0 : 0.32,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="flex w-full flex-col gap-3">
        {redeemed ? (
          <div className="flex flex-col gap-1">
            <p
              className="text-md font-bold"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {t("redeemed_state", { name: redeemed.inviterDisplayName })}
            </p>
            {redeemed.discount?.phoneRequired ? (
              <a
                href={phoneHref}
                onClick={onLeave}
                className="flex min-h-11 items-center text-sm font-bold underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: "var(--color-main)" }}
              >
                {t("redeemed_phone")}
              </a>
            ) : redeemed.discount ? (
              <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("redeemed_discount")}
              </p>
            ) : null}
          </div>
        ) : saved ? null : (
          <form className="flex w-full flex-col gap-3" onSubmit={(e) => void handleRedeem(e)}>
            <label
              htmlFor={inputId}
              className="text-sm font-bold"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {t("have_code")}
            </label>
            <p id={disclosureId} className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("redeem_disclosure")}
            </p>
            <input
              id={inputId}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="PUHU-…"
              autoComplete="off"
              aria-describedby={disclosureId}
              className="min-h-11 w-full rounded-[var(--radius-card)] border bg-[var(--color-surface)] px-3 text-base focus-visible:outline-none focus-visible:ring-2"
              style={{
                borderColor: "color-mix(in srgb, var(--color-main) 12%, transparent)",
                color: "var(--color-main)",
              }}
              disabled={busy}
            />
            <Button type="submit" disabled={busy} fullWidth className="gap-2.5">
              <Gift size={24} strokeWidth={1.75} aria-hidden />
              {busy ? t("redeeming") : t("use_code")}
            </Button>
            {error ? <FormError message={error} /> : null}
          </form>
        )}
        {saved ? (
          <p className="text-sm font-bold" style={{ color: "var(--color-secondary)" }} role="status">
            {t("redeem_saved")}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

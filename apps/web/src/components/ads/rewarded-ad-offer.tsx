"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AdPlacementId, type AdRewardOfferView } from "@mentor/types";
import { Card } from "@mentor/ui";
import { completeRewardSession, createRewardSession, closeRewardSession, fetchRewardOffer } from "@/lib/ads";
import { notifyEconomyChanged } from "@/lib/economy";
import { configureLimitedPrivacy, withGpt, type GptEvent, type GptService, type GptSlot } from "@/lib/google-publisher-tag";

export function RewardedAdOffer({ placementId = AdPlacementId.DASHBOARD_REWARDED_COIN }: { placementId?: AdPlacementId }) {
  const t = useTranslations("ads.rewarded");
  const locale = useLocale();
  const [offer, setOffer] = useState<AdRewardOfferView | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const showRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const grantedRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    let slot: GptSlot | null = null;
    let pubads: GptService | null = null;
    const listeners: Array<[string, (event: GptEvent) => void]> = [];
    void fetchRewardOffer(placementId).then(async (nextOffer) => {
      if (cancelled) return;
      setOffer(nextOffer);
      if (!nextOffer.eligible || !nextOffer.adUnitPath) return;
      await withGpt((gpt) => {
        if (cancelled) return;
        configureLimitedPrivacy(gpt, nextOffer.audienceTreatment);
        pubads = gpt.pubads();
        slot = gpt.defineOutOfPageSlot(nextOffer.adUnitPath!, gpt.enums.OutOfPageFormat.REWARDED)?.addService(pubads) ?? null;
        if (!slot) return;
        const own = (event: GptEvent) => event.slot === slot;
        const onReady = (event: GptEvent) => {
          if (!own(event) || !event.makeRewardedVisible || cancelled) return;
          showRef.current = () => event.makeRewardedVisible?.();
          setReady(true);
        };
        const onGranted = (event: GptEvent) => {
          if (!own(event) || !sessionIdRef.current || grantedRef.current) return;
          grantedRef.current = true;
          void completeRewardSession(sessionIdRef.current)
            .then((result) => {
              setMessage(t("success", { count: result.rewardCoin }));
              notifyEconomyChanged();
              setOffer((current) => current ? { ...current, eligible: false, enabled: false, dailyRemaining: Math.max(0, current.dailyRemaining - 1) } : current);
            })
            .catch(() => setMessage(t("complete_error")))
            .finally(() => setBusy(false));
        };
        const onClosed = (event: GptEvent) => {
          if (!own(event)) return;
          const id = sessionIdRef.current;
          if (id && !grantedRef.current) void closeRewardSession(id).catch(() => undefined);
          setBusy(false);
          setReady(false);
          window.setTimeout(() => buttonRef.current?.focus(), 0);
        };
        listeners.push(["rewardedSlotReady", onReady], ["rewardedSlotGranted", onGranted], ["rewardedSlotClosed", onClosed]);
        listeners.forEach(([name, listener]) => pubads!.addEventListener(name, listener));
        gpt.enableServices();
        gpt.display(slot);
      });
    }).catch(() => { if (!cancelled) setOffer(null); });
    return () => {
      cancelled = true;
      if (sessionIdRef.current && !grantedRef.current) {
        void closeRewardSession(sessionIdRef.current).catch(() => undefined);
      }
      listeners.forEach(([name, listener]) => pubads?.removeEventListener(name, listener));
      if (slot && window.googletag) window.googletag.destroySlots([slot]);
    };
  }, [placementId, t]);

  if (!offer) return null;
  if (!offer.eligible) {
    if (message) return <p className="text-sm text-[var(--color-secondary)]" role="status">{message}</p>;
    if (!["COOLDOWN_ACTIVE", "DAILY_LIMIT_REACHED", "ACTIVE_SESSION_EXISTS"].includes(offer.reason)) return null;
    const status = offer.reason === "COOLDOWN_ACTIVE" && offer.cooldownEndsAt
      ? t("cooldown", { time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(offer.cooldownEndsAt)) })
      : offer.reason === "DAILY_LIMIT_REACHED" ? t("daily_done") : t("session_active");
    return <Card><p className="text-sm text-[var(--color-secondary)]" role="status">{status}</p></Card>;
  }

  const start = async () => {
    if (!ready || !showRef.current || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const session = await createRewardSession(placementId);
      sessionIdRef.current = session.id;
      grantedRef.current = false;
      showRef.current();
    } catch {
      setBusy(false);
      setMessage(t("start_error"));
    }
  };

  return (
    <Card className="text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]">{t("eyebrow")}</p>
      <h2 className="mt-2 text-lg font-bold text-[var(--color-main)]">{t("title", { count: offer.rewardCoin })}</h2>
      <p className="mt-1 text-sm text-[var(--color-secondary)]">{t("body", { remaining: offer.dailyRemaining })}</p>
      <button
        ref={buttonRef}
        type="button"
        disabled={!ready || busy}
        onClick={() => void start()}
        className="mt-4 min-h-11 rounded-full bg-[var(--color-main)] px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-main)] focus-visible:ring-offset-2"
      >
        {busy ? t("opening") : ready ? t("cta") : t("preparing")}
      </button>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs text-[var(--color-secondary)]">{message}</p>
    </Card>
  );
}

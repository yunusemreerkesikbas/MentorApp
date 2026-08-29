"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AdPlacementId, type AdRewardOfferView } from "@mentor/types";
import { Card } from "@mentor/ui";
import { completeRewardSession, createRewardSession, closeRewardSession, fetchRewardOffer } from "@/lib/ads";
import { retryIdempotent } from "@/lib/ad-reward-retry";
import { notifyEconomyChanged } from "@/lib/economy";
import { configureLimitedPrivacy, withGpt, type GptEvent, type GptService, type GptSlot } from "@/lib/google-publisher-tag";

const REWARDED_READY_TIMEOUT_MS = 10_000;

export function RewardedAdOffer({ placementId = AdPlacementId.DASHBOARD_REWARDED_COIN }: { placementId?: AdPlacementId }) {
  const t = useTranslations("ads.rewarded");
  const locale = useLocale();
  const [offer, setOffer] = useState<AdRewardOfferView | null>(null);
  const [availability, setAvailability] = useState<"preparing" | "ready" | "unavailable">("preparing");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const showRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const grantedRef = useRef(false);
  const activeRef = useRef(false);
  const terminalRef = useRef(false);
  const unavailableRef = useRef<HTMLParagraphElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (availability !== "unavailable" || !restoreFocusRef.current) return;
    if (grantedRef.current && !message) return;
    restoreFocusRef.current = false;
    unavailableRef.current?.focus();
  }, [availability, message]);

  useEffect(() => {
    activeRef.current = true;
    terminalRef.current = false;
    let cancelled = false;
    let slot: GptSlot | null = null;
    let pubads: GptService | null = null;
    let readyTimeout: number | null = null;
    const listeners: Array<[string, (event: GptEvent) => void]> = [];
    const clearReadyTimeout = () => {
      if (readyTimeout !== null) window.clearTimeout(readyTimeout);
      readyTimeout = null;
    };
    const makeUnavailable = () => {
      if (terminalRef.current) return;
      terminalRef.current = true;
      clearReadyTimeout();
      showRef.current = null;
      setAvailability("unavailable");
      setBusy(false);
      const id = sessionIdRef.current;
      if (id && !grantedRef.current) {
        sessionIdRef.current = null;
        idempotencyKeyRef.current = null;
        void closeRewardSession(id).catch(() => undefined);
      }
    };
    void fetchRewardOffer(placementId).then(async (nextOffer) => {
      if (cancelled) return;
      setOffer(nextOffer);
      if (!nextOffer.eligible || !nextOffer.adUnitPath) return;
      await withGpt((gpt) => {
        if (cancelled) return;
        configureLimitedPrivacy(gpt, nextOffer.audienceTreatment);
        pubads = gpt.pubads();
        slot = gpt.defineOutOfPageSlot(nextOffer.adUnitPath!, gpt.enums.OutOfPageFormat.REWARDED)?.addService(pubads) ?? null;
        if (!slot) {
          makeUnavailable();
          return;
        }
        const own = (event: GptEvent) => event.slot === slot;
        const onRender = (event: GptEvent) => {
          if (!own(event) || cancelled || terminalRef.current || event.isEmpty !== true) return;
          makeUnavailable();
        };
        const onReady = (event: GptEvent) => {
          if (!own(event) || !event.makeRewardedVisible || cancelled || terminalRef.current) return;
          clearReadyTimeout();
          showRef.current = () => event.makeRewardedVisible?.();
          setAvailability("ready");
        };
        const onGranted = (event: GptEvent) => {
          if (!own(event) || !sessionIdRef.current || grantedRef.current || terminalRef.current) return;
          grantedRef.current = true;
          const sessionId = sessionIdRef.current;
          void retryIdempotent(() => completeRewardSession(sessionId))
            .then((result) => {
              setMessage(t("success", { count: result.rewardCoin }));
              notifyEconomyChanged();
              setOffer((current) => current ? { ...current, eligible: false, enabled: false, dailyRemaining: Math.max(0, current.dailyRemaining - 1) } : current);
            })
            .catch(() => {
              setMessage(t("complete_error"));
              notifyEconomyChanged();
            })
            .finally(() => {
              sessionIdRef.current = null;
              idempotencyKeyRef.current = null;
              setBusy(false);
            });
        };
        const onClosed = (event: GptEvent) => {
          if (!own(event) || terminalRef.current) return;
          terminalRef.current = true;
          const id = sessionIdRef.current;
          if (id && !grantedRef.current) void closeRewardSession(id).catch(() => undefined);
          sessionIdRef.current = null;
          idempotencyKeyRef.current = null;
          setBusy(false);
          restoreFocusRef.current = true;
          setAvailability("unavailable");
        };
        listeners.push(
          ["slotRenderEnded", onRender],
          ["rewardedSlotReady", onReady],
          ["rewardedSlotGranted", onGranted],
          ["rewardedSlotClosed", onClosed],
        );
        listeners.forEach(([name, listener]) => pubads!.addEventListener(name, listener));
        gpt.enableServices();
        gpt.display(slot);
        readyTimeout = window.setTimeout(makeUnavailable, REWARDED_READY_TIMEOUT_MS);
      });
    }).catch(() => {
      if (!cancelled) setAvailability("unavailable");
    });
    return () => {
      cancelled = true;
      activeRef.current = false;
      terminalRef.current = true;
      clearReadyTimeout();
      if (sessionIdRef.current && !grantedRef.current) {
        void closeRewardSession(sessionIdRef.current).catch(() => undefined);
      }
      listeners.forEach(([name, listener]) => pubads?.removeEventListener(name, listener));
      if (slot && window.googletag) window.googletag.destroySlots([slot]);
    };
  }, [placementId, t]);

  if (!offer) return null;
  if (!offer.eligible) {
    if (message) {
      return (
        <p
          ref={unavailableRef}
          className="text-sm text-[var(--color-secondary)] outline-none"
          role="status"
          tabIndex={-1}
        >
          {message}
        </p>
      );
    }
    if (!["COOLDOWN_ACTIVE", "DAILY_LIMIT_REACHED", "ACTIVE_SESSION_EXISTS"].includes(offer.reason)) return null;
    const status = offer.reason === "COOLDOWN_ACTIVE" && offer.cooldownEndsAt
      ? t("cooldown", { time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(offer.cooldownEndsAt)) })
      : offer.reason === "DAILY_LIMIT_REACHED" ? t("daily_done") : t("session_active");
    return <Card><p className="text-sm text-[var(--color-secondary)]" role="status">{status}</p></Card>;
  }

  const start = async () => {
    if (availability !== "ready" || !showRef.current || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      const idempotencyKey = idempotencyKeyRef.current;
      const session = await retryIdempotent(() => createRewardSession(placementId, idempotencyKey));
      if (!activeRef.current || terminalRef.current) {
        await closeRewardSession(session.id).catch(() => undefined);
        idempotencyKeyRef.current = null;
        return;
      }
      sessionIdRef.current = session.id;
      grantedRef.current = false;
      const show = showRef.current;
      if (!show) throw new Error("Rewarded slot is no longer ready");
      show();
    } catch {
      const id = sessionIdRef.current;
      if (id) await closeRewardSession(id).catch(() => undefined);
      sessionIdRef.current = null;
      idempotencyKeyRef.current = null;
      setBusy(false);
      setMessage(t("start_error"));
      restoreFocusRef.current = true;
      terminalRef.current = true;
      setAvailability("unavailable");
    }
  };

  if (availability === "unavailable") {
    return (
      <Card>
        <p
          ref={unavailableRef}
          className="text-sm text-[var(--color-secondary)] outline-none"
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          {message ?? t("unavailable")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]">{t("eyebrow")}</p>
      <h2 className="mt-2 text-lg font-bold text-[var(--color-main)]">{t("title", { count: offer.rewardCoin })}</h2>
      <p className="mt-1 text-sm text-[var(--color-secondary)]">{t("body", { remaining: offer.dailyRemaining })}</p>
      <button
        type="button"
        disabled={availability !== "ready" || busy}
        onClick={() => void start()}
        className="mt-4 min-h-11 rounded-full bg-[var(--color-main)] px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-main)] focus-visible:ring-offset-2"
      >
        {busy ? t("opening") : availability === "ready" ? t("cta") : t("preparing")}
      </button>
      <p aria-live="polite" className="mt-2 min-h-5 text-xs text-[var(--color-secondary)]">{message}</p>
    </Card>
  );
}

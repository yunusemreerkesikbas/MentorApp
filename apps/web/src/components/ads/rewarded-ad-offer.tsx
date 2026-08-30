"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Coins } from "lucide-react";
import { AdPlacementId, type AdRewardOfferView } from "@mentor/types";
import { completeRewardSession, createRewardSession, closeRewardSession, fetchRewardOffer } from "@/lib/ads";
import { retryIdempotent } from "@/lib/ad-reward-retry";
import { notifyCoinCelebration, notifyEconomyChanged } from "@/lib/economy";
import { configureLimitedPrivacy, withGpt, type GptEvent, type GptService, type GptSlot } from "@/lib/google-publisher-tag";

const REWARDED_READY_TIMEOUT_MS = 10_000;

interface RewardedAdOfferProps {
  onCompleted?: (rewardCoin: number) => void;
  onOfferChange?: (offer: AdRewardOfferView) => void;
  onUnavailable?: () => void;
  placementId?: AdPlacementId;
  variant?: "list" | "promoted";
}

export function RewardedAdOffer({
  onCompleted,
  onOfferChange,
  onUnavailable,
  placementId = AdPlacementId.DASHBOARD_REWARDED_COIN,
  variant = "list",
}: RewardedAdOfferProps) {
  const t = useTranslations("ads.rewarded");
  const locale = useLocale();
  const [offer, setOffer] = useState<AdRewardOfferView | null>(null);
  const [availability, setAvailability] = useState<"preparing" | "ready" | "unavailable">("preparing");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const [initialDailyRights, setInitialDailyRights] = useState(0);
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
    grantedRef.current = false;
    showRef.current = null;
    let cancelled = false;
    let completionSucceeded = false;
    let slotClosed = false;
    let refreshQueued = false;
    let slot: GptSlot | null = null;
    let pubads: GptService | null = null;
    let readyTimeout: number | null = null;
    const listeners: Array<[string, (event: GptEvent) => void]> = [];
    const clearReadyTimeout = () => {
      if (readyTimeout !== null) window.clearTimeout(readyTimeout);
      readyTimeout = null;
    };
    const prepareNextOffer = () => {
      if (!completionSucceeded || !slotClosed || refreshQueued || cancelled) return;
      refreshQueued = true;
      setMessage(null);
      setAvailability("preparing");
      setRefreshGeneration((generation) => generation + 1);
    };
    const makeUnavailable = () => {
      if (terminalRef.current) return;
      terminalRef.current = true;
      clearReadyTimeout();
      showRef.current = null;
      setAvailability("unavailable");
      setBusy(false);
      onUnavailable?.();
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
      setInitialDailyRights((current) => Math.max(current, nextOffer.dailyRemaining));
      onOfferChange?.(nextOffer);
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
              notifyEconomyChanged();
              if (result.rewardCoin > 0) {
                notifyCoinCelebration(result.rewardCoin);
              }
              completionSucceeded = true;
              onCompleted?.(result.rewardCoin);
              prepareNextOffer();
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
          slotClosed = true;
          const id = sessionIdRef.current;
          if (id && !grantedRef.current) void closeRewardSession(id).catch(() => undefined);
          sessionIdRef.current = null;
          idempotencyKeyRef.current = null;
          setBusy(false);
          if (grantedRef.current) {
            setAvailability("preparing");
            prepareNextOffer();
          } else {
            restoreFocusRef.current = true;
            setAvailability("unavailable");
            onUnavailable?.();
          }
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
      if (!cancelled) {
        setAvailability("unavailable");
        onUnavailable?.();
      }
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
  }, [onCompleted, onOfferChange, onUnavailable, placementId, refreshGeneration, t]);

  if (!offer) return null;
  if (!offer.eligible) {
    if (message) {
      return <RewardedOfferSurface variant={variant} status={message} statusRef={unavailableRef} />;
    }
    if (!["COOLDOWN_ACTIVE", "DAILY_LIMIT_REACHED", "ACTIVE_SESSION_EXISTS"].includes(offer.reason)) return null;
    const status = offer.reason === "COOLDOWN_ACTIVE" && offer.cooldownEndsAt
      ? t("cooldown", { time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(offer.cooldownEndsAt)) })
      : offer.reason === "DAILY_LIMIT_REACHED" && initialDailyRights > 0
        ? t("daily_done_progress", {
            completed: initialDailyRights,
          })
        : offer.reason === "DAILY_LIMIT_REACHED"
          ? t("daily_done")
          : t("session_active");
    return <RewardedOfferSurface variant={variant} status={status} />;
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
      onUnavailable?.();
    }
  };

  if (availability === "unavailable") {
    return (
      <RewardedOfferSurface
        variant={variant}
        status={message ?? t("unavailable")}
        statusRef={unavailableRef}
      />
    );
  }

  return (
    <RewardedOfferSurface variant={variant}>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-base font-semibold text-[var(--color-main)]">
          {t("quest_title")}
        </span>
        <span className="mt-1 block text-xs font-bold text-[var(--color-secondary)]">
          {t("quest_badge", { remaining: offer.dailyRemaining })}
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-[var(--color-chip-text)]">
        {t("quest_coin", { count: offer.rewardCoin })}
      </span>
      <button
        type="button"
        disabled={availability !== "ready" || busy}
        onClick={() => void start()}
        className="min-h-11 shrink-0 rounded-[var(--radius-card)] bg-[var(--color-btn)] px-3 py-2 text-sm font-bold text-[var(--color-btn-label)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
      >
        {busy ? t("opening") : availability === "ready" ? t("cta") : t("preparing")}
      </button>
      {message ? <span className="sr-only" aria-live="polite">{message}</span> : null}
    </RewardedOfferSurface>
  );
}

function RewardedOfferSurface({
  children,
  status,
  statusRef,
  variant,
}: {
  children?: ReactNode;
  status?: string;
  statusRef?: RefObject<HTMLParagraphElement | null>;
  variant: "list" | "promoted";
}) {
  const content = status ? (
    <>
      <span className="grid size-6 shrink-0 place-items-center text-[var(--color-chip-text)]">
        <Coins aria-hidden size={20} />
      </span>
      <p
        ref={statusRef}
        aria-live="polite"
        className="min-w-0 flex-1 text-sm text-[var(--color-secondary)] outline-none"
        role="status"
        tabIndex={statusRef ? -1 : undefined}
      >
        {status}
      </p>
    </>
  ) : (
    <>
      <span className="grid size-6 shrink-0 place-items-center text-[var(--color-chip-text)]">
        <Coins aria-hidden size={20} />
      </span>
      {children}
    </>
  );
  const className = `flex min-h-14 min-w-0 items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-progress-track)] bg-[var(--color-accent-soft)] p-3 ${
    variant === "promoted" ? "mt-3 shadow-[var(--shadow-card)]" : ""
  }`;

  return variant === "list" ? (
    <li className={className} data-testid="rewarded-ad-quest">{content}</li>
  ) : (
    <div className={className} data-testid="rewarded-ad-quest">{content}</div>
  );
}

"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@solar-icons/react/linear/close";
import type { PremiumFeatureId } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { FormError } from "@/components/form";
import { PremiumPaywallBenefits } from "./premium-paywall-benefits";
import { SubscriptionTrialNotice } from "./subscription-trial-notice";
import { PremiumPaywallFooter } from "./premium-paywall-footer";
import { PremiumPaywallPlanPicker } from "./premium-paywall-plan-picker";
import { usePremiumPaywall } from "./use-premium-paywall";

function headlineKey(feature: PremiumFeatureId | undefined): string {
  switch (feature) {
    case "coach.chat":
      return "headline_coach";
    case "plan.ai":
      return "headline_plan";
    case "vision.note":
      return "headline_vision";
    case "weekly.narration":
    case "deep.analysis":
      return "headline_analysis";
    case "mood.reflection":
      return "headline_mood";
    case "ghost.narration":
      return "headline_ghost";
    case "daily.greeting":
      return "headline_greeting";
    case "session.reflection":
      return "headline_session";
    default:
      return "headline";
  }
}

const subscribeToClientMount = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

interface PremiumPaywallModalProps {
  sourceFeature?: PremiumFeatureId;
  /** Coupon handed over by a campaign surface — applied on open, never trusted blindly. */
  initialCode?: string;
  onClose: () => void;
}

export function PremiumPaywallModal({
  sourceFeature,
  initialCode,
  onClose,
}: PremiumPaywallModalProps) {
  const t = useTranslations("paywall");
  const tSub = useTranslations("subscription");
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );
  const purchase = usePremiumPaywall(initialCode);
  const { loading, purchaseEnabled, pendingCheckout, selected, view, loadError, refreshEligibility } = purchase;

  useEffect(() => {
    document.documentElement.classList.add("mentor-dialog-open");
    return () => {
      document.documentElement.classList.remove("mentor-dialog-open");
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const showTrial = !loading && purchaseEnabled && !pendingCheckout && selected && purchase.includesTrial;

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="premium-paywall"
      className="relative flex h-full w-full flex-col overflow-hidden max-lg:animate-sheet-enter lg:h-auto lg:max-h-[90dvh] lg:w-[480px] lg:animate-dialog-enter lg:rounded-[var(--paywall-plan-radius)] lg:shadow-[var(--shadow-card)] motion-reduce:animate-none"
      style={{
        backgroundColor: "var(--color-bg)",
        backgroundImage: [
          "radial-gradient(ellipse 120% 70% at 50% -8%, color-mix(in srgb, var(--blob-blue) 55%, transparent), transparent 64%)",
          "radial-gradient(ellipse 70% 48% at 100% 0%, color-mix(in srgb, var(--blob-pink) 42%, transparent), transparent 60%)",
          "radial-gradient(ellipse 55% 40% at 0% 10%, color-mix(in srgb, var(--blob-cyan) 36%, transparent), transparent 58%)",
          "radial-gradient(ellipse 90% 36% at 50% 100%, color-mix(in srgb, var(--blob-blue) 22%, transparent), transparent 70%)",
        ].join(", "),
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <span
          className="mentor-blob-drift absolute -top-24 left-[calc(50%-14rem)] size-[28rem] rounded-full blur-[150px]"
          style={{
            backgroundColor: "var(--blob-blue)",
            opacity: "var(--blob-blue-opacity)",
            animationDelay: "0s",
          }}
        />
        <span
          className="mentor-blob-drift absolute -top-8 -right-16 size-80 rounded-full blur-[150px]"
          style={{
            backgroundColor: "var(--blob-pink)",
            opacity: "var(--blob-pink-opacity)",
            animationDelay: "-8s",
          }}
        />
        <span
          className="mentor-blob-drift absolute top-16 -left-12 size-72 rounded-full blur-[150px]"
          style={{
            backgroundColor: "var(--blob-cyan)",
            opacity: "var(--blob-cyan-opacity)",
            animationDelay: "-16s",
          }}
        />
      </div>

      <header className="relative z-[1] grid shrink-0 grid-cols-[44px_1fr_44px] items-center px-5 pt-[max(12px,env(safe-area-inset-top))] lg:px-8 lg:pt-4">
        <span aria-hidden />
        <motion.div
          className="flex items-center justify-center gap-2"
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- animated SVG mark */}
          <img
            src="/img/upgrade-premium-2.svg"
            alt=""
            width={28}
            height={28}
            className="size-7 object-contain"
            draggable={false}
            aria-hidden
          />
          <p
            className="text-base font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {t("brand")}
          </p>
          <span
            className="rounded-[var(--radius-card)] border px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{
              borderColor: "var(--color-main)",
              color: "var(--color-main)",
              backgroundColor: "var(--color-bg)",
            }}
          >
            {t("badge_premium")}
          </span>
        </motion.div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          aria-label={t("close")}
          style={{ color: "var(--color-main)" }}
        >
          <CloseIcon size={22} strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <div data-testid="premium-paywall-body" className="mentor-scrollarea relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4 pt-3 [mask-image:linear-gradient(to_bottom,black_calc(100%-16px),transparent)] lg:px-8 lg:pt-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.h2
            id={titleId}
            className="max-w-[18ch] text-balance text-[32px] font-bold leading-[1.2]"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.06, ease: "easeOut" }}
          >
            {t(headlineKey(sourceFeature))}
          </motion.h2>
          {showTrial ? (
            <p
              data-testid="premium-paywall-trial-badge"
              className="rounded-[var(--radius-card)] px-3 py-1 text-sm font-bold"
              style={{
                backgroundColor: "var(--color-success)",
                color: "var(--color-btn-label)",
              }}
            >
              {tSub("trial_days", { days: selected.trialDays })}
            </p>
          ) : null}
          <motion.p
            className="text-pretty text-sm leading-relaxed"
            style={{ color: "var(--color-body)" }}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1, ease: "easeOut" }}
          >
            {t("subtitle")}
          </motion.p>
        </div>

        <PremiumPaywallBenefits sourceFeature={sourceFeature} />

        {loadError ? (
          <div className="mt-6">
            <FormError message={loadError} />
          </div>
        ) : null}

        {showTrial ? (
          <div className="mt-5">
            <SubscriptionTrialNotice eligibility={view?.trialEligibility} trialDays={selected.trialDays} onPhoneVerified={() => void refreshEligibility()} />
          </div>
        ) : null}

      </div>

      {/* Plans stay pinned with the checkout controls: the price never scrolls out, only the benefits do. */}
      <div className="relative z-[1] flex shrink-0 flex-col gap-2 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-1 lg:gap-3 lg:px-8 lg:pb-6 lg:pt-2">
        {loading ? (
          <SkeletonGroup label={t("loading")} className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-[var(--paywall-plan-radius)]" />
            <Skeleton className="h-20 rounded-[var(--paywall-plan-radius)]" />
          </SkeletonGroup>
        ) : null}
        <PremiumPaywallPlanPicker purchase={purchase} />
        <PremiumPaywallFooter purchase={purchase} />
      </div>
    </div>
  );

  return createPortal(
    <div className="premium-paywall-theme fixed inset-0 z-[80] lg:flex lg:items-center lg:justify-center lg:p-6">
      <button
        type="button"
        aria-label={t("close")}
        className="animate-dialog-backdrop-enter absolute inset-0 hidden bg-[color-mix(in_srgb,var(--color-bg)_72%,transparent)] backdrop-blur-sm lg:block motion-reduce:animate-none"
        onClick={onClose}
      />
      <div className="relative z-[81] h-full w-full lg:h-auto lg:w-auto">
        {panel}
      </div>
    </div>,
    document.body,
  );
}

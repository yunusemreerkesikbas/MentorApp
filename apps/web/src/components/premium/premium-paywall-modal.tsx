"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { StarsIcon } from "@solar-icons/react/bold/stars";
import { CloseIcon } from "@solar-icons/react/linear/close";
import type { PremiumFeatureId } from "@mentor/types";
import { Skeleton, SkeletonGroup, skeletonStaggerStyle } from "@mentor/ui";
import { FormError } from "@/components/form";
import { PremiumBadge } from "./premium-badge";
import { PremiumPaywallBenefits } from "./premium-paywall-benefits";
import { SubscriptionTrialNotice } from "./subscription-trial-notice";
import { PremiumPaywallFooter } from "./premium-paywall-footer";
import { PremiumPaywallPlanPicker } from "./premium-paywall-plan-picker";
import { usePremiumPaywall } from "./use-premium-paywall";

const SHEET_QUERY = "(max-width: 1023px)";
const EASE_SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

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

function PaywallCheckoutSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup label={label} className="flex flex-col gap-2 lg:gap-3">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((idx) => (
          <div
            key={idx}
            className="relative flex min-h-[96px] flex-col justify-between rounded-[var(--paywall-plan-radius)] border-2 border-transparent px-3 py-3"
            style={{ backgroundColor: "var(--color-surface-container)" }}
          >
            {idx === 1 ? (
              <Skeleton
                className="absolute -top-2 right-2 h-5 w-16 rounded-[var(--radius-card)]"
                style={skeletonStaggerStyle(1)}
              />
            ) : null}
            <Skeleton
              className="h-3.5 w-16 rounded-md"
              style={skeletonStaggerStyle(idx)}
            />
            <div className="flex flex-col gap-1.5">
              <Skeleton
                className="h-6 w-28 rounded-md"
                style={skeletonStaggerStyle(idx + 1)}
              />
              <Skeleton
                className="h-3 w-20 rounded-md"
                style={skeletonStaggerStyle(idx + 2)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:gap-3">
        <div className="flex min-h-11 items-start gap-3 py-0.5">
          <Skeleton
            className="mt-0.5 size-5 shrink-0 rounded-md"
            style={skeletonStaggerStyle(2)}
          />
          <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
            <Skeleton
              className="h-3.5 w-full rounded-md"
              style={skeletonStaggerStyle(2)}
            />
            <Skeleton
              className="h-3.5 w-4/5 rounded-md"
              style={skeletonStaggerStyle(3)}
            />
          </div>
        </div>
        <Skeleton
          className="min-h-[60px] w-full rounded-[var(--play-radius)]"
          style={skeletonStaggerStyle(3)}
        />
        <div className="flex min-h-11 items-center justify-center">
          <Skeleton
            className="h-3.5 w-32 rounded-md"
            style={skeletonStaggerStyle(4)}
          />
        </div>
      </div>
    </SkeletonGroup>
  );
}

const subscribeToClientMount = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

interface PremiumPaywallModalProps {
  sourceFeature?: PremiumFeatureId;
  headline?: string;
  subtitle?: string;
  /** Coupon handed over by a campaign surface — applied on open, never trusted blindly. */
  initialCode?: string;
  onClose: () => void;
}

export function PremiumPaywallModal({
  sourceFeature,
  headline,
  subtitle,
  initialCode,
  onClose,
}: PremiumPaywallModalProps) {
  const t = useTranslations("paywall");
  const tSub = useTranslations("subscription");
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const [slides] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(SHEET_QUERY).matches,
  );
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );
  const purchase = usePremiumPaywall(initialCode);
  const {
    loading,
    purchaseEnabled,
    pendingCheckout,
    selected,
    view,
    loadError,
    refreshEligibility,
  } = purchase;

  const requestClose = useCallback(() => {
    if (reduceMotion) {
      onClose();
      return;
    }
    setClosing((prev) => (prev ? prev : true));
  }, [onClose, reduceMotion]);

  useEffect(() => {
    document.documentElement.classList.add("mentor-dialog-open");
    return () => {
      document.documentElement.classList.remove("mentor-dialog-open");
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  if (!mounted) return null;

  const showTrial =
    !loading &&
    purchaseEnabled &&
    !pendingCheckout &&
    selected &&
    purchase.includesTrial;

  const initialSurface = slides
    ? { opacity: 0, y: 48 }
    : { opacity: 0, scale: 0.96, y: 12, filter: "blur(2px)" };
  const openSurface = slides
    ? { opacity: 1, y: 0 }
    : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" };
  const closeSurface = slides
    ? { opacity: 0, y: 36 }
    : { opacity: 0, scale: 0.96, y: 6, filter: "blur(0px)" };

  const panel = (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="premium-paywall"
      initial={reduceMotion ? false : initialSurface}
      animate={closing ? closeSurface : openSurface}
      transition={{
        duration: reduceMotion
          ? 0
          : closing
            ? slides
              ? 0.18
              : 0.15
            : slides
              ? 0.28
              : 0.25,
        ease: EASE_SMOOTH_OUT,
      }}
      onAnimationComplete={() => {
        if (closing) onClose();
      }}
      className="relative flex h-full w-full flex-col overflow-hidden lg:h-auto lg:max-h-[90dvh] lg:w-[480px] lg:rounded-[var(--paywall-plan-radius)] lg:shadow-[var(--shadow-card)]"
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
          transition={{ duration: 0.25, delay: 0.03, ease: EASE_SMOOTH_OUT }}
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
          <PremiumBadge />
        </motion.div>
        <button
          type="button"
          onClick={requestClose}
          className="flex size-11 items-center justify-center rounded-[var(--radius-card)] transition-transform duration-150 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none motion-reduce:active:scale-100"
          aria-label={t("close")}
          style={{ color: "var(--color-main)" }}
        >
          <CloseIcon size={22} strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <div
        data-testid="premium-paywall-body"
        className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-3 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:px-8 lg:pt-4"
      >
        <div className="flex flex-col items-center gap-2.5 text-center">
          <motion.h2
            id={titleId}
            className="max-w-[18ch] text-balance text-[30px] font-bold leading-[1.18] lg:text-[32px]"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.06, ease: EASE_SMOOTH_OUT }}
          >
            {headline ?? t(headlineKey(sourceFeature))}
          </motion.h2>
          {showTrial ? (
            <motion.div
              data-testid="premium-paywall-trial-badge"
              className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-extrabold tracking-wide shadow-sm"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--color-success) 45%, transparent)",
                backgroundColor:
                  "color-mix(in srgb, var(--color-success) 16%, transparent)",
                color: "var(--color-success)",
              }}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, delay: 0.08, ease: EASE_SMOOTH_OUT }}
            >
              <StarsIcon size={15} aria-hidden />
              <span>{tSub("trial_days", { days: selected.trialDays })}</span>
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <span className="font-semibold" style={{ color: "var(--color-main)" }}>
                {t("trial_zero_today")}
              </span>
            </motion.div>
          ) : null}
          <motion.p
            className="max-w-[38ch] text-pretty text-sm leading-relaxed"
            style={{ color: "var(--color-body)" }}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1, ease: EASE_SMOOTH_OUT }}
          >
            {subtitle ?? t("subtitle")}
          </motion.p>
        </div>

        <PremiumPaywallBenefits
          sourceFeature={sourceFeature}
          highlightNotebook={Boolean(headline && !sourceFeature)}
        />

        {loadError ? (
          <div className="mt-6">
            <FormError message={loadError} />
          </div>
        ) : null}

        {showTrial ? (
          <div className="mt-4">
            <SubscriptionTrialNotice
              eligibility={view?.trialEligibility}
              trialDays={selected.trialDays}
              onPhoneVerified={() => void refreshEligibility()}
            />
          </div>
        ) : null}
      </div>

      {/* Plans stay pinned with the checkout controls: the price never scrolls out, only the benefits do. */}
      <motion.div
        className="relative z-[1] flex shrink-0 flex-col gap-2 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-1 lg:gap-3 lg:px-8 lg:pb-6 lg:pt-2"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.12, ease: EASE_SMOOTH_OUT }}
      >
        {loading ? (
          <PaywallCheckoutSkeleton label={t("loading")} />
        ) : (
          <>
            <PremiumPaywallPlanPicker purchase={purchase} />
            <PremiumPaywallFooter purchase={purchase} />
          </>
        )}
      </motion.div>
    </motion.div>
  );

  return createPortal(
    <div className="premium-paywall-theme fixed inset-0 z-[80] lg:flex lg:items-center lg:justify-center lg:p-6">
      <motion.button
        type="button"
        aria-label={t("close")}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{
          duration: reduceMotion ? 0 : closing ? 0.15 : 0.25,
          ease: EASE_SMOOTH_OUT,
        }}
        className="absolute inset-0 hidden bg-[color-mix(in_srgb,var(--color-bg)_72%,transparent)] backdrop-blur-sm lg:block"
        onClick={requestClose}
      />
      <div className="relative z-[81] h-full w-full lg:h-auto lg:w-auto">
        {panel}
      </div>
    </div>,
    document.body,
  );
}

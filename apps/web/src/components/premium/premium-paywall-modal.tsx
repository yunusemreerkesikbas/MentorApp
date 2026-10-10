"use client";

import { useEffect, useId, useSyncExternalStore, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CalendarDays, Camera, MessageCircle, Sparkles, X } from "lucide-react";
import type { PremiumFeatureId } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { staggerItemVariants, staggerListVariants } from "@/lib/stagger-motion";
import { FormError } from "@/components/form";
import { SubscriptionTrialNotice } from "./subscription-trial-notice";
import { PremiumPaywallFooter } from "./premium-paywall-footer";
import { PremiumPaywallPlanPicker } from "./premium-paywall-plan-picker";
import { usePremiumPaywall } from "./use-premium-paywall";

function headlineKey(feature: PremiumFeatureId | undefined): string {
  switch (feature) {
    case "coach.chat":
      return "headline_coach";
    case "photo.categorize":
      return "headline_photo";
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

const BENEFITS = [
  { key: "benefit_coach", Icon: MessageCircle },
  { key: "benefit_analysis", Icon: Sparkles },
  { key: "benefit_photo", Icon: Camera },
  { key: "benefit_plan", Icon: CalendarDays },
] as const satisfies readonly {
  key: "benefit_coach" | "benefit_analysis" | "benefit_photo" | "benefit_plan";
  Icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    "aria-hidden"?: boolean;
  }>;
}[];

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
          <X size={22} aria-hidden />
        </button>
      </header>

      <div data-testid="premium-paywall-body" className="mentor-scrollarea relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 lg:px-8 lg:pt-2">
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.div
            className="grid size-[120px] place-items-center lg:size-24"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- animated SVG hero */}
            <img
              src="/img/upgrade-premium-2.svg"
              alt=""
              width={120}
              height={120}
              className={`size-[120px] object-contain lg:size-24 ${reduceMotion ? "" : "mentor-puhu-bounce"}`}
              draggable={false}
              aria-hidden
            />
          </motion.div>
          <motion.h2
            id={titleId}
            className="max-w-[18ch] text-balance text-[32px] font-bold leading-[1.2]"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.12, ease: "easeOut" }}
          >
            {t(headlineKey(sourceFeature))}
          </motion.h2>
          <motion.p
            className="max-w-[36ch] text-pretty text-sm leading-relaxed"
            style={{ color: "var(--color-body)" }}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.16, ease: "easeOut" }}
          >
            {t("subtitle")}
          </motion.p>
        </div>

        <motion.ul
          className="mt-5 flex flex-col gap-3 lg:mt-4 lg:gap-2"
          variants={reduceMotion ? undefined : staggerListVariants}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
        >
          {BENEFITS.map(({ key, Icon }) => (
            <motion.li
              key={key}
              variants={reduceMotion ? undefined : staggerItemVariants}
              className="flex items-center gap-3 text-left text-sm leading-relaxed"
              style={{ color: "var(--color-main)" }}
            >
              <Icon size={24} strokeWidth={1.75} aria-hidden />
              {t(key)}
            </motion.li>
          ))}
        </motion.ul>

        {loadError ? (
          <div className="mt-6">
            <FormError message={loadError} />
          </div>
        ) : null}

        {!loading && purchaseEnabled && !pendingCheckout && selected && purchase.includesTrial ? (
          <div className="mt-5">
            <SubscriptionTrialNotice eligibility={view?.trialEligibility} trialDays={selected.trialDays} onPhoneVerified={() => void refreshEligibility()} />
          </div>
        ) : null}

        <div className="min-h-8 flex-1 lg:hidden" aria-hidden />

        {loading ? (
          <SkeletonGroup label={t("loading")} className="mt-5 grid grid-cols-2 gap-3 lg:mt-4">
            <Skeleton className="h-28 rounded-[var(--paywall-plan-radius)]" />
            <Skeleton className="h-28 rounded-[var(--paywall-plan-radius)]" />
          </SkeletonGroup>
        ) : null}

        <PremiumPaywallPlanPicker purchase={purchase} />

      </div>

      <div className="relative z-[1] shrink-0 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-6 lg:pt-4">
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

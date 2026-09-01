"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, X } from "lucide-react";
import { PromotionDiscountType, type PromotionSummary } from "@mentor/types";
import { Button } from "@mentor/ui";
import { useIsMounted } from "@/lib/use-is-mounted";

interface PromotionCardProps {
  promotion: PromotionSummary;
  onClose: () => void;
  /** Hands the code to the paywall so the user never retypes what this card just showed them. */
  onContinue: (code: string | null) => void;
}

type CopyStatus = "idle" | "copied" | "failed";

const COPY_FEEDBACK_MS = 2000;

/**
 * Campaign announcement — editorial direction: the DISCOUNT MAGNITUDE is the hero, set large, and
 * the coupon rides a perforated ticket below it.
 *
 * It deliberately shows NO price. A price would presuppose a plan the user has not chosen yet, and
 * `planIds` can scope a campaign to a single plan, which would make the figure simply wrong — a
 * third plan makes "the price" meaningless altogether. So the card states the SCOPE ("valid on all
 * plans") and the paywall, which is also where the pre-purchase disclosure lives, does the pricing.
 *
 * The magnitude comes from `summary.discountValue`, which the API clamps to what checkout will
 * really apply — the admin's raw entry can exceed `promotions.max_percent`.
 */
export function PromotionCard({ promotion, onClose, onContinue }: PromotionCardProps) {
  const t = useTranslations("paywall");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const codeLabelId = useId();
  const mounted = useIsMounted();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function handleCopy() {
    if (!promotion.code) return;
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    let next: CopyStatus = "failed";
    try {
      await navigator.clipboard.writeText(promotion.code);
      next = "copied";
    } catch {
      // Clipboard can be denied; the primary action does not need it, so this stays a hint.
    }
    setCopyStatus(next);
    copyResetRef.current = setTimeout(() => {
      setCopyStatus("idle");
      copyResetRef.current = null;
    }, COPY_FEEDBACK_MS);
  }

  if (!mounted) return null;

  const magnitude =
    promotion.discountType === PromotionDiscountType.PERCENT
      ? t("discount_percent", { value: promotion.discountValue })
      : (promotion.discountValue / 100).toLocaleString(
          locale === "en" ? "en-GB" : "tr-TR",
          { style: "currency", currency: "TRY", maximumFractionDigits: 0 },
        );

  const scope =
    promotion.planNames === null
      ? t("scope_all_plans")
      : t("scope_limited_plans", { plans: promotion.planNames.join(", ") });

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <motion.button
        type="button"
        aria-label={t("close")}
        className="absolute inset-0 hidden bg-[color-mix(in_srgb,var(--color-main)_45%,transparent)] backdrop-blur-[2px] sm:block"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.25 }}
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="promotion-card"
        className="relative flex w-full flex-col overflow-hidden bg-[var(--color-surface)] max-sm:h-full sm:max-h-[min(90dvh,40rem)] sm:max-w-md sm:rounded-[24px] sm:shadow-[var(--shadow-card)]"
        initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 360, damping: 30, mass: 0.9 }
        }
      >
        {/* Single soft mark, anchored off-canvas — the only decoration the editorial layout takes. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-[70px] -top-[70px] size-[240px] rounded-full opacity-[.16]"
          style={{ backgroundColor: "var(--color-chip)" }}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] text-[var(--color-main)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:top-3"
        >
          <X size={20} strokeWidth={2.25} aria-hidden />
        </button>

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto mentor-scrollarea px-8 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))] sm:pt-14">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- animated SVG asset */}
            <img
              src="/animation/gift-premium.svg"
              alt=""
              width={40}
              height={40}
              className="size-10 object-contain"
              draggable={false}
            />
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--color-secondary)" }}
            >
              {t("promotion_eyebrow")}
            </p>
          </div>

          <motion.div
            className="mt-[18px] flex items-start gap-3"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : 0.08 }}
          >
            <p
              className="text-[116px] font-extrabold leading-[0.82] tracking-[-0.05em] tabular-nums"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {magnitude}
            </p>
            <p
              className="mt-3.5 text-[15px] font-bold leading-tight [writing-mode:vertical-rl]"
              style={{ color: "var(--color-main)" }}
            >
              {t("discount_word")}
            </p>
          </motion.div>

          <h2
            id={titleId}
            className="mt-[22px] text-pretty text-[28px] font-extrabold leading-tight tracking-[-0.01em]"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {promotion.label}
          </h2>

          {/* Scope, never a price — see the component doc. */}
          <div className="mt-2.5 flex max-w-[24rem] items-start gap-2">
            <Check
              size={18}
              strokeWidth={2.4}
              aria-hidden
              className="mt-0.5 shrink-0"
              style={{ color: "var(--color-success)" }}
            />
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--color-body)" }}>
              <strong style={{ color: "var(--color-main)" }}>{scope}</strong>{" "}
              {promotion.code ? t("scope_pick_plan_code") : t("scope_pick_plan_auto")}
            </p>
          </div>

          {promotion.code ? (
            <motion.div
              className="relative mt-6 flex min-h-[76px] items-stretch rounded-[14px] bg-[var(--color-bg)]"
              style={{
                outline: "1.5px solid var(--color-main)",
                outlineOffset: "-1.5px",
                WebkitMaskImage:
                  "radial-gradient(circle 9px at 0 50%, transparent 9px, #000 9.5px), radial-gradient(circle 9px at 100% 50%, transparent 9px, #000 9.5px)",
                maskImage:
                  "radial-gradient(circle 9px at 0 50%, transparent 9px, #000 9.5px), radial-gradient(circle 9px at 100% 50%, transparent 9px, #000 9.5px)",
                WebkitMaskComposite: "source-in",
                maskComposite: "intersect",
              }}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : 0.2 }}
            >
              <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pl-6 pr-3">
                <p
                  id={codeLabelId}
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("coupon_label")}
                </p>
                <code
                  aria-labelledby={codeLabelId}
                  className="mt-0.5 block truncate text-xl font-extrabold tracking-[0.1em]"
                  style={{ color: "var(--color-main)" }}
                >
                  {promotion.code}
                </code>
              </div>

              <div
                aria-hidden
                className="my-3 w-px shrink-0 border-l-[1.5px] border-dashed"
                style={{ borderColor: "color-mix(in srgb, var(--color-main) 25%, transparent)" }}
              />

              <div className="flex shrink-0 items-center py-2.5 pl-3 pr-4">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  aria-live="polite"
                  className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13px] font-bold outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                  style={{
                    backgroundColor: "var(--color-btn)",
                    color: "var(--color-btn-label)",
                  }}
                >
                  {copyStatus === "copied" ? (
                    <Check size={14} strokeWidth={2.4} aria-hidden />
                  ) : (
                    <Copy size={14} strokeWidth={2} aria-hidden />
                  )}
                  {copyStatus === "copied"
                    ? t("coupon_copied")
                    : copyStatus === "failed"
                      ? t("coupon_copy_failed")
                      : t("coupon_copy")}
                </button>
              </div>
            </motion.div>
          ) : null}

          <div className="min-h-6 flex-1" aria-hidden />
        </div>

        <div className="relative z-[1] flex shrink-0 flex-col gap-2 px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          <Button fullWidth className="min-h-[56px] gap-2.5" onClick={() => onContinue(promotion.code)}>
            {promotion.code ? (
              <Check size={20} strokeWidth={2.2} aria-hidden />
            ) : null}
            {promotion.code ? t("promotion_apply_cta") : t("promotion_cta")}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("promotion_dismiss")}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

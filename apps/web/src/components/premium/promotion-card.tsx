"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, X } from "lucide-react";
import type { PromotionSummary } from "@mentor/types";
import { Button } from "@mentor/ui";
import { formatPromotionMagnitude } from "@/lib/promotions";
import { useIsMounted } from "@/lib/use-is-mounted";

interface PromotionCardProps {
  promotion: PromotionSummary;
  onClose: () => void;
  /** Hands the code to the paywall so the user never retypes what this card just showed them. */
  onContinue: (code: string | null) => void;
}

type CopyStatus = "idle" | "copied" | "failed";

const COPY_FEEDBACK_MS = 2000;

/** Serrated ticket edge: a half-circle bitten out of both vertical edges, every PITCH pixels. */
const NOTCH_PX = 7;
const PITCH_PX = 22;
const BORDER_PX = 1.5;

function serratedMask(offsetY: number) {
  const circle = (side: "left" | "right") =>
    `radial-gradient(circle ${NOTCH_PX}px at ${side} center, transparent ${NOTCH_PX - 0.5}px, #000 ${NOTCH_PX}px)`;
  const image = `${circle("left")}, ${circle("right")}`;
  const size = `100% ${PITCH_PX}px, 100% ${PITCH_PX}px`;
  // The inner layer is inset by the border width, so its own box origin sits lower; shifting the
  // tiles back by that much keeps the two rows of notches on the same lines.
  const position = `left ${offsetY}px, right ${offsetY}px`;
  return {
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskSize: size,
    maskSize: size,
    WebkitMaskPosition: position,
    maskPosition: position,
    WebkitMaskRepeat: "repeat-y, repeat-y",
    maskRepeat: "repeat-y, repeat-y",
    WebkitMaskComposite: "source-in",
    maskComposite: "intersect",
  } as const;
}

/**
 * Campaign announcement — editorial direction: the DISCOUNT MAGNITUDE is the hero, set large, and
 * the coupon rides a perforated ticket below it.
 *
 * It deliberately shows NO price. A price would presuppose a plan the user has not chosen yet, and
 * `planIds` can scope a campaign to a single plan, which would make the figure simply wrong - a
 * third plan makes "the price" meaningless altogether. So the card states the SCOPE ("valid on all
 * plans") and the paywall, which is also where the pre-purchase disclosure lives, does the pricing.
 *
 * The magnitude comes from `summary.discountValue`, which the API clamps to what checkout will
 * really apply - the admin's raw entry can exceed `promotions.max_percent`.
 *
 * Two strings are admin-written per campaign (`eyebrow`, `description`) and fall back to the
 * default wording when blank, so a new campaign speaks in its own voice without a deploy. The
 * scope line and the CTA stay derived on purpose: hand-written versions could promise what
 * checkout will not honour.
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

  // The card animates out before it reports back: `open` drives the exit and the pending action
  // runs on `onExitComplete`. Without it the parent unmounts us mid-frame and the modal vanishes.
  const [open, setOpen] = useState(true);
  const settleRef = useRef<() => void>(onClose);

  const requestClose = useCallback(() => {
    settleRef.current = onClose;
    setOpen(false);
  }, [onClose]);

  const requestContinue = useCallback(() => {
    const code = promotion.code;
    settleRef.current = () => onContinue(code);
    setOpen(false);
  }, [onContinue, promotion.code]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [requestClose]);

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

  const validUntil = useMemo(() => {
    if (!promotion.endsAt) return null;
    const end = new Date(promotion.endsAt);
    if (Number.isNaN(end.getTime())) return null;
    const sameYear = end.getUTCFullYear() === new Date().getUTCFullYear();
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", {
      day: "numeric",
      month: "long",
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(end);
  }, [promotion.endsAt, locale]);

  if (!mounted) return null;

  const magnitude = formatPromotionMagnitude(promotion, locale, (value) =>
    t("discount_percent", { value }),
  );

  const scope =
    promotion.planNames === null
      ? t("scope_all_plans")
      : t("scope_limited_plans", { plans: promotion.planNames.join(", ") });

  // One source of stagger: children declare only what they do, the list order sets the timing.
  const column: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06, delayChildren: 0.05 } },
  };
  const rise: Variants = {
    hidden: reduceMotion ? {} : { opacity: 0, y: 12 },
    shown: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.32 } },
  };
  const pop: Variants = {
    hidden: reduceMotion ? {} : { opacity: 0, scale: 0.86 },
    shown: {
      opacity: 1,
      scale: 1,
      transition: reduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 420, damping: 26, mass: 0.8 },
    },
  };
  const settle: Variants = {
    hidden: reduceMotion ? {} : { opacity: 0, y: 16, rotate: -1.5 },
    shown: {
      opacity: 1,
      y: 0,
      rotate: 0,
      transition: reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 24 },
    },
  };
  const stampIn: Variants = {
    hidden: reduceMotion ? {} : { opacity: 0, scale: 0.8, rotate: -14 },
    shown: {
      opacity: 1,
      scale: 1,
      rotate: -3,
      transition: reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 18 },
    },
  };

  return createPortal(
    <AnimatePresence onExitComplete={() => settleRef.current()}>
      {open ? (
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
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={requestClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="promotion-card"
            className="relative flex w-full flex-col overflow-hidden bg-[var(--color-surface)] max-sm:h-full sm:max-h-[min(90dvh,42rem)] sm:max-w-md sm:rounded-[24px] sm:shadow-[var(--shadow-card)]"
            initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 360, damping: 30, mass: 0.9 }
            }
          >
            {/* Single soft mark, anchored off-canvas - the only decoration the editorial layout takes. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -left-[70px] -top-[70px] size-[240px] rounded-full opacity-[.16]"
              style={{ backgroundColor: "var(--color-chip)" }}
            />

            <button
              type="button"
              onClick={requestClose}
              aria-label={t("close")}
              className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] text-[var(--color-main)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:top-3"
            >
              <X size={20} strokeWidth={2.25} aria-hidden />
            </button>

            {/*
              Mobile centres the whole block: the previous flex spacer pushed the ticket to the top
              and left the middle of the screen empty. From `sm` up the card is short enough that
              the original top-aligned rhythm reads better.
            */}
            <motion.div
              variants={column}
              initial="hidden"
              animate="shown"
              className="mentor-scrollarea relative z-[1] flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 pb-6 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))] sm:justify-start sm:px-8 sm:pt-14"
            >
              <motion.div variants={rise} className="flex items-center gap-2.5">
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
                  {promotion.eyebrow ?? t("promotion_eyebrow")}
                </p>
              </motion.div>

              <motion.div variants={pop} className="mt-[18px] flex origin-left items-start gap-3">
                <p
                  className="text-[clamp(84px,26vw,116px)] font-extrabold leading-[0.82] tracking-[-0.05em] tabular-nums"
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

              <motion.h2
                variants={rise}
                id={titleId}
                className="mt-[22px] text-pretty text-[28px] font-extrabold leading-tight tracking-[-0.01em]"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {promotion.label}
              </motion.h2>

              {promotion.description ? (
                <motion.p
                  variants={rise}
                  className="mt-2 max-w-[26rem] text-pretty text-[15px] leading-relaxed"
                  style={{ color: "var(--color-body)" }}
                >
                  {promotion.description}
                </motion.p>
              ) : null}

              {/* Scope, never a price - see the component doc. */}
              <motion.div variants={rise} className="mt-2.5 flex max-w-[26rem] items-start gap-2">
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
              </motion.div>

              {promotion.code ? (
                <motion.div
                  variants={settle}
                  className="mt-6 p-[1.5px]"
                  style={{ backgroundColor: "var(--color-main)", ...serratedMask(0) }}
                >
                  <div
                    className="flex min-h-[76px] items-stretch"
                    style={{ backgroundColor: "var(--color-bg)", ...serratedMask(-BORDER_PX) }}
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
                      style={{
                        borderColor: "color-mix(in srgb, var(--color-main) 25%, transparent)",
                      }}
                    />

                    <div className="flex shrink-0 items-center py-2.5 pl-3 pr-4">
                      <button
                        type="button"
                        onClick={() => void handleCopy()}
                        aria-live="polite"
                        className="flex min-h-11 cursor-pointer items-center gap-1.5 overflow-hidden rounded-full px-4 text-[13px] font-bold outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                        style={{
                          backgroundColor: "var(--color-btn)",
                          color: "var(--color-btn-label)",
                        }}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={copyStatus}
                            className="flex items-center gap-1.5 whitespace-nowrap"
                            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                            transition={{ duration: reduceMotion ? 0 : 0.16 }}
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
                          </motion.span>
                        </AnimatePresence>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {/*
                A dated campaign says so, as a stamp pressed onto the ticket. Plain fact, no
                countdown and no "last chance" - voice.md rules out loss aversion.
              */}
              {validUntil ? (
                <motion.div
                  variants={stampIn}
                  data-testid="promotion-validity"
                  className="mt-3.5 flex w-fit origin-right items-center gap-2.5 self-end rounded-[10px] border-[1.5px] border-dashed px-3.5 py-2"
                  style={{
                    borderColor: "color-mix(in srgb, var(--color-main) 18%, transparent)",
                    color: "var(--color-secondary)",
                  }}
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "color-mix(in srgb, var(--color-secondary) 45%, transparent)" }}
                  />
                  <span className="text-[13px] font-semibold leading-none">
                    {t("valid_until", { date: validUntil })}
                  </span>
                </motion.div>
              ) : null}
            </motion.div>

            <div className="relative z-[1] flex shrink-0 flex-col gap-2 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 max-sm:border-t max-sm:border-[color-mix(in_srgb,var(--color-main)_10%,transparent)] sm:px-8">
              <Button fullWidth className="min-h-[56px] gap-2.5" onClick={requestContinue}>
                {promotion.code ? <Check size={20} strokeWidth={2.2} aria-hidden /> : null}
                {promotion.code ? t("promotion_apply_cta") : t("promotion_cta")}
              </Button>
              <button
                type="button"
                onClick={requestClose}
                className="min-h-11 w-full text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: "var(--color-secondary)" }}
              >
                {t("promotion_dismiss")}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

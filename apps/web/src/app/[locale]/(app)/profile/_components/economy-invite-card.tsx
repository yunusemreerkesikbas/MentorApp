"use client";
import { CloseCircleIcon as X } from "@solar-icons/react/linear/close-circle";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type { InviteCodeView } from "@mentor/types";
import { formatPromotionMagnitude } from "@/lib/promotions";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useIsMounted } from "@/lib/use-is-mounted";
import { InviteProgress } from "./invite-progress";
import { InviteRedeemPanel } from "./invite-redeem-panel";
import { InviteShareTicket } from "./invite-share-ticket";

interface EconomyInviteCardProps {
  invite: InviteCodeView;
  onClose: () => void;
  onRedeemed: () => void;
  /** Where focus goes on close: the "Davet et" row, whichever way the card was opened. */
  returnFocusTo: () => HTMLElement | null;
}

/** Deep saturated violet — stronger contrast for white type + gift art. */
const HERO_GRADIENT =
  "linear-gradient(165deg, #6d28d9 0%, color-mix(in srgb, var(--color-chip) 22%, #5b21b6) 42%, #3b0764 100%)";

function InviteSparkle({
  className,
  delay = 0,
  reduceMotion,
}: {
  className?: string;
  delay?: number;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.span
      aria-hidden
      className={["pointer-events-none absolute text-white/90", className].join(" ")}
      animate={
        reduceMotion
          ? { opacity: 0.85, scale: 1 }
          : { opacity: [0.4, 1, 0.5], scale: [0.8, 1.15, 0.9], rotate: [0, 12, -6] }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 2.4, delay, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.5 13.8 9.2 21.5 11 13.8 12.8 12 20.5 10.2 12.8 2.5 11 10.2 9.2 12 1.5Z" />
      </svg>
    </motion.span>
  );
}

/**
 * Invite overlay: share the personal link, see how many friends came, and (until the viewer has
 * used one) redeem a friend's code. Full-screen on mobile; centered modal on `sm+`. Rewards stay
 * server-side on conversion. This shell owns the hero, the dialog focus contract and the friend
 * discount line; the ticket, progress line and redeem dock are subcomponents.
 */
export function EconomyInviteCard({
  invite,
  onClose,
  onRedeemed,
  returnFocusTo,
}: EconomyInviteCardProps) {
  const t = useTranslations("economy");
  const paywall = useTranslations("paywall");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const mounted = useIsMounted();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useDialogFocus({
    dialogRef,
    initialFocusRef: closeRef,
    active: mounted,
    onEscape: onClose,
    returnFocusTo,
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  // The view carries the friend discount (null when none is live or its lookup failed), so the
  // line is final on first paint: the Coin alone, or the discount as well.
  const subtitle = invite.friendDiscount
    ? t("invite_subtitle_discount", {
        discount: formatPromotionMagnitude(invite.friendDiscount, locale, (value) =>
          paywall("discount_percent", { value }),
        ),
        coin: invite.rewardCoin,
      })
    : t("invite_subtitle_plain", { coin: invite.rewardCoin });

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <motion.button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 hidden cursor-default bg-[color-mix(in_srgb,var(--color-main)_45%,transparent)] backdrop-blur-[2px] sm:block"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.25 }}
        onClick={onClose}
      />

      <motion.div
        ref={dialogRef}
        className="relative flex w-full min-h-0 max-h-none flex-col overflow-hidden max-sm:h-full sm:max-h-[min(90dvh,44rem)] sm:max-w-md sm:rounded-[24px] sm:shadow-[var(--shadow-card)]"
        style={{ background: HERO_GRADIENT }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 360, damping: 30, mass: 0.9 }
        }
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.7) 0 1.25px, transparent 1.6px)",
            backgroundSize: "26px 26px",
            backgroundPosition: "10px 12px",
          }}
        />
        {/* Soft spotlight behind mascot */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[42%] w-[120%] -translate-x-1/2 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 55% 70% at 50% 0%, rgba(255,255,255,0.35) 0%, transparent 70%)",
          }}
        />

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] text-[var(--color-main)] shadow-[var(--shadow-card)] outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white sm:right-3 sm:top-3"
          aria-label={t("invite_close")}
        >
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col max-sm:min-h-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto mentor-scrollarea sm:flex-initial">
            {/* Top: mascot — compact stack on desktop, airy on mobile */}
            <div className="shrink-0 px-5 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))] sm:pt-8">
              <div className="relative mx-auto size-[140px] sm:size-[112px]">
                <InviteSparkle className="-left-1 top-2" delay={0.15} reduceMotion={reduceMotion} />
                <InviteSparkle className="-right-2 top-8" delay={0.55} reduceMotion={reduceMotion} />
                <InviteSparkle className="bottom-1 left-0" delay={0.9} reduceMotion={reduceMotion} />
                <motion.div
                  className="grid size-full place-items-center"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.7, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 18, delay: 0.05 }
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- animated SVG asset */}
                  <img
                    src="/animation/gift-premium.svg"
                    alt=""
                    width={140}
                    height={140}
                    className="h-full w-full object-contain drop-shadow-[0_12px_28px_rgba(20,5,40,0.35)]"
                    draggable={false}
                  />
                </motion.div>
              </div>
            </div>

            {/* Middle: fill + center on mobile only; hug content on desktop */}
            <div className="flex min-h-0 flex-col items-center px-5 py-4 max-sm:flex-1 max-sm:justify-center sm:py-2 sm:pb-5">
              <div className="w-full max-w-md">
                <motion.p
                  className="text-center text-[12px] font-bold uppercase tracking-[0.18em] text-white"
                  style={{ fontFamily: "var(--font-body)" }}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.1 }}
                >
                  {t("invite_eyebrow")}
                </motion.p>
                <motion.h2
                  id={titleId}
                  className="mt-3 text-center text-[32px] font-bold leading-[1.15] text-balance text-white whitespace-pre-line sm:mt-2 sm:text-[26px]"
                  style={{ fontFamily: "var(--font-heading)" }}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.16 }}
                >
                  {t("invite_headline")}
                </motion.h2>
                {/* Two lines reserved, so the ticket below sits the same with either line. */}
                <div className="mx-auto mt-2.5 min-h-12 max-w-[22rem] sm:mt-2">
                  <motion.p
                    className="text-center text-[15px] leading-relaxed text-white/90"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.28 }}
                  >
                    {subtitle}
                  </motion.p>
                </div>

                <InviteShareTicket code={invite.code} reduceMotion={reduceMotion} />
                <InviteProgress
                  joined={invite.joinedCount}
                  converted={invite.convertedCount}
                  names={invite.joined.map((friend) => friend.displayName)}
                  reduceMotion={reduceMotion}
                />
              </div>
            </div>
          </div>

          <InviteRedeemPanel
            redeemed={invite.redeemed}
            canRedeem={invite.canRedeem}
            onRedeemed={onRedeemed}
            onLeave={onClose}
            reduceMotion={reduceMotion}
          />
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

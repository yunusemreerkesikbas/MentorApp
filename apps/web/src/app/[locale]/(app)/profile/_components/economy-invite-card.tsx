"use client";
import { Gift, X } from "lucide-react";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { redeemInviteSchema } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { FormError } from "@/components/form";
import { redeemInviteCode } from "@/lib/economy";
import { useIsMounted } from "@/lib/use-is-mounted";

interface EconomyInviteCardProps {
  code: string;
  onClose: () => void;
  onRedeemed: () => void;
}

type CopyStatus = "idle" | "copied" | "failed";

const COPY_FEEDBACK_MS = 2000;

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
 * Invite overlay: share code (ticket) + redeem someone else's code.
 * Full-screen on mobile; centered modal on `sm+`. Rewards stay server-side on conversion.
 */
export function EconomyInviteCard({
  code,
  onClose,
  onRedeemed,
}: EconomyInviteCardProps) {
  const translate = useTranslations("economy");
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const codeLabelId = useId();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const mounted = useIsMounted();
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function flashCopyStatus(next: CopyStatus) {
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    setCopyStatus(next);
    copyResetRef.current = setTimeout(() => {
      setCopyStatus("idle");
      copyResetRef.current = null;
    }, COPY_FEEDBACK_MS);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      flashCopyStatus("copied");
    } catch {
      flashCopyStatus("failed");
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setRedeemError(null);
    setRedeemSuccess(null);
    const parsed = redeemInviteSchema.safeParse({ code: input });
    if (!parsed.success) {
      setRedeemError(translate("redeem_invalid"));
      return;
    }
    setBusy(true);
    try {
      const result = await redeemInviteCode(parsed.data.code);
      setInput("");
      setRedeemSuccess(
        result.status === "PENDING"
          ? translate("redeem_pending")
          : translate("redeem_saved"),
      );
      onRedeemed();
    } catch (err) {
      setRedeemError(
        err instanceof ApiClientError
          ? err.body.message
          : translate("redeem_failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <motion.button
        type="button"
        aria-label={translate("invite_close")}
        className="absolute inset-0 hidden bg-[color-mix(in_srgb,var(--color-main)_45%,transparent)] backdrop-blur-[2px] sm:block"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.25 }}
        onClick={onClose}
      />

      <motion.div
        className="relative flex w-full min-h-0 max-h-none flex-col overflow-hidden max-sm:h-full sm:max-h-[min(90dvh,36rem)] sm:max-w-md sm:rounded-[24px] sm:shadow-[var(--shadow-card)]"
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
          type="button"
          onClick={onClose}
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] text-[var(--color-main)] shadow-[var(--shadow-card)] outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white sm:right-3 sm:top-3"
          aria-label={translate("invite_close")}
        >
          <X size={20} strokeWidth={2.25} aria-hidden />
        </button>

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col max-sm:min-h-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto mentor-scrollarea sm:flex-none">
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
                  {translate("invite_eyebrow")}
                </motion.p>
                <motion.h2
                  id={titleId}
                  className="mt-3 text-center text-[32px] font-bold leading-[1.15] text-balance text-white whitespace-pre-line sm:mt-2 sm:text-[26px]"
                  style={{ fontFamily: "var(--font-heading)" }}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.16 }}
                >
                  {translate("invite_headline")}
                </motion.h2>
                <motion.p
                  className="mx-auto mt-2.5 max-w-[22rem] text-center text-[15px] leading-relaxed text-white/90 sm:mt-2"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.22 }}
                >
                  {translate("invite_subtitle")}
                </motion.p>

                <motion.div
                  className="relative mx-auto mt-5 w-full sm:mt-4"
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : 0.28 }}
                >
                  <div
                    className="relative flex min-h-[76px] items-stretch bg-black/25 shadow-[0_8px_24px_rgba(20,5,40,0.35)] ring-1 ring-white/20 backdrop-blur-md"
                    style={{
                      borderRadius: 18,
                      WebkitMaskImage:
                        "radial-gradient(circle 10px at 0 50%, transparent 10px, #000 10.5px), radial-gradient(circle 10px at 100% 50%, transparent 10px, #000 10.5px)",
                      maskImage:
                        "radial-gradient(circle 10px at 0 50%, transparent 10px, #000 10.5px), radial-gradient(circle 10px at 100% 50%, transparent 10px, #000 10.5px)",
                      WebkitMaskComposite: "source-in",
                      maskComposite: "intersect",
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col justify-center py-3.5 pl-7 pr-3 text-left">
                      <p
                        id={codeLabelId}
                        className="text-[11px] font-semibold uppercase tracking-wide text-white/65"
                      >
                        {translate("invite_code_label")}
                      </p>
                      <code
                        className="mt-0.5 block truncate text-[15px] font-bold tracking-[0.04em] text-white tabular-nums sm:text-base"
                        aria-labelledby={codeLabelId}
                      >
                        {code}
                      </code>
                    </div>

                    <div
                      aria-hidden
                      className="my-3.5 w-px shrink-0 border-l border-dashed border-white/40"
                    />

                    <div className="flex shrink-0 items-center p-2.5 pl-2.5 pr-3.5">
                      <button
                        type="button"
                        onClick={() => void handleCopy()}
                        className="min-w-[5.75rem] cursor-pointer rounded-full bg-[var(--color-surface)] px-5 py-2.5 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white"
                        style={{ fontFamily: "var(--font-body)" }}
                        aria-live="polite"
                      >
                        {copyStatus === "copied"
                          ? translate("copied")
                          : copyStatus === "failed"
                            ? translate("copy_failed")
                            : translate("invite_copy_short")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Full-bleed redeem dock — flush to modal edges; parent clips bottom radius */}
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
            <form
              className="flex w-full flex-col gap-3"
              onSubmit={(e) => void handleRedeem(e)}
            >
              <label
                htmlFor="economy-invite-redeem"
                className="text-sm font-bold"
                style={{
                  color: "var(--color-main)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {translate("have_code")}
              </label>
              <input
                id="economy-invite-redeem"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="MENTOR-…"
                autoComplete="off"
                className="min-h-11 w-full rounded-[var(--radius-card)] border bg-[var(--color-surface)] px-3 text-base focus-visible:outline-none focus-visible:ring-2"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--color-main) 12%, transparent)",
                  color: "var(--color-main)",
                }}
                disabled={busy}
              />
              <Button type="submit" disabled={busy} fullWidth className="gap-2.5">
                <Gift size={24} strokeWidth={2.2} aria-hidden />
                {busy ? translate("redeeming") : translate("use_code")}
              </Button>
              {redeemError ? <FormError message={redeemError} /> : null}
              {redeemSuccess ? (
                <p
                  className="text-sm"
                  style={{ color: "var(--color-secondary)" }}
                  role="status"
                >
                  {redeemSuccess}
                </p>
              ) : null}
            </form>
          </motion.div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { buildInviteLink } from "@/lib/invite-link";

type ShareStatus = "idle" | "copied" | "failed";

const STATUS_FEEDBACK_MS = 2000;

interface InviteShareTicketProps {
  code: string;
  reduceMotion: boolean | null;
}

/**
 * The ticket: the code stays readable (a friend can be told it out loud) and one button puts the
 * personal link in a chat. Where the device has no share sheet the link is copied instead, and
 * the line under the ticket says so.
 */
export function InviteShareTicket({ code, reduceMotion }: InviteShareTicketProps) {
  const t = useTranslations("economy");
  const locale = useLocale();
  const codeLabelId = useId();
  const [status, setStatus] = useState<ShareStatus>("idle");
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  function flash(next: ShareStatus) {
    if (resetRef.current) clearTimeout(resetRef.current);
    setStatus(next);
    resetRef.current = setTimeout(() => {
      setStatus("idle");
      resetRef.current = null;
    }, STATUS_FEEDBACK_MS);
  }

  async function handleShare() {
    const url = buildInviteLink(code, locale);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: t("invite_share_text"), url });
        return;
      } catch (err) {
        // A dismissed share sheet is an answer, not a failure: no copy behind their back.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("copied");
    } catch {
      flash("failed");
    }
  }

  return (
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
            {t("invite_code_label")}
          </p>
          <code
            className="mt-0.5 block truncate text-[15px] font-bold tracking-[0.04em] text-white tabular-nums sm:text-base"
            aria-labelledby={codeLabelId}
          >
            {code}
          </code>
        </div>

        <div aria-hidden className="my-3.5 w-px shrink-0 border-l border-dashed border-white/40" />

        <div className="flex shrink-0 items-center p-2.5 pl-2.5 pr-3.5">
          <button
            type="button"
            onClick={() => void handleShare()}
            className="min-w-[5.75rem] cursor-pointer rounded-full bg-[var(--color-surface)] px-5 py-2.5 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {t("invite_share")}
          </button>
        </div>
      </div>

      <p role="status" className="mt-2 min-h-5 text-center text-sm font-semibold text-white">
        {status === "copied"
          ? t("invite_link_copied")
          : status === "failed"
            ? t("copy_failed")
            : null}
      </p>
    </motion.div>
  );
}

"use client";

import { Sparkles, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NotebookLimitsDto } from "@mentor/types";
import { useNotebookSound } from "@/lib/notebook-sfx";

/**
 * The page's title on the wall, and the sound switch.
 *
 * A new notebook is not made from here: the wrapped package at the end of the desk is that control
 * (`desk-package.tsx`), and a second button with the same name said everything twice.
 */
export function DeskHeader({
  limits,
  onUpgrade,
}: {
  limits?: NotebookLimitsDto;
  onUpgrade?: () => void;
}) {
  const t = useTranslations("notebooks");
  const sound = useNotebookSound();
  const maxCustom = limits?.maxCustomNotebooks ?? null;
  const showQuota = Boolean(
    limits && !limits.isPremium && maxCustom !== null && maxCustom > 0,
  );
  const isFull = Boolean(
    showQuota && maxCustom !== null && (limits?.customNotebookCount ?? 0) >= maxCustom,
  );

  return (
    <header className="desk-header relative z-30 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="desk-header-text">
        <h1 className="desk-title text-[34px] sm:text-[46px]">{t("title")}</h1>
        <p
          className="mt-2 text-[15px] font-semibold leading-snug"
          style={{ color: "var(--desk-ink-soft)" }}
        >
          {t("subtitle")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {showQuota && maxCustom !== null ? (
          isFull && onUpgrade ? (
            <button
              type="button"
              onClick={onUpgrade}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tabular-nums outline-none transition-transform duration-150 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                backgroundColor: "color-mix(in srgb, var(--desk-ink) 14%, transparent)",
                color: "var(--desk-ink)",
              }}
            >
              <Sparkles aria-hidden size={13} />
              {t("quota_custom_badge", {
                used: Math.min(limits!.customNotebookCount, maxCustom),
                max: maxCustom,
              })}
            </button>
          ) : (
            <span
              className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold tabular-nums"
              style={{
                backgroundColor: "color-mix(in srgb, var(--desk-ink) 10%, transparent)",
                color: "var(--desk-ink-soft)",
              }}
            >
              {t("quota_custom_badge", {
                used: Math.min(limits!.customNotebookCount, maxCustom),
                max: maxCustom,
              })}
            </span>
          )
        ) : null}
        <button
          type="button"
          className="desk-sound"
          aria-label={t("desk.sound")}
          aria-pressed={sound.enabled}
          onClick={sound.toggle}
        >
          {sound.enabled ? (
            <Volume2 aria-hidden size={20} />
          ) : (
            <VolumeX aria-hidden size={20} />
          )}
        </button>
      </div>
    </header>
  );
}

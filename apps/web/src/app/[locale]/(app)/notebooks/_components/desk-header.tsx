"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNotebookSound } from "@/lib/notebook-sfx";

/**
 * The page's title on the wall, and the sound switch.
 *
 * A new notebook is not made from here: the wrapped package at the end of the desk is that control
 * (`desk-package.tsx`), and a second button with the same name said everything twice.
 */
export function DeskHeader() {
  const t = useTranslations("notebooks");
  const sound = useNotebookSound();
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

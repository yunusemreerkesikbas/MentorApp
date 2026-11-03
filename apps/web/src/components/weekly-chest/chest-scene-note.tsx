"use client";

import "@fontsource-variable/caveat/wght.css";
import { useEffect } from "react";
import { Coins, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { WeeklyChestView } from "@mentor/types";
import { CoinCelebrationVisual } from "@/components/coin-celebration-visual";
import { PREMIUM_MASK_PATH } from "@/components/premium/premium-mask";
import { PuhuImage } from "@/components/puhu-image";
import { playCoinChime } from "@/lib/coin-sound";
import { useIsPremium } from "@/lib/subscription-context";
import { noteLines } from "./weekly-chest-model";

/** "Bu haftanın emeği": the taped paper note with the week's numbers, signed by Puhu. */
export function ChestSceneNote({ chest, animate }: { chest: WeeklyChestView; animate: boolean }) {
  const t = useTranslations("weeklyChest");
  const lines = chest.summary ? noteLines(chest.summary) : [];
  // The mask is premium's mark, so only a premium member's Puhu signs with it.
  const premium = useIsPremium();

  return (
    <div
      className={`wc-note relative w-[78%] max-w-[340px] px-6 pb-4 pt-6 ${animate ? "wc-note-in" : ""}`}
      data-testid="weekly-chest-note"
    >
      <span className="wc-tape" aria-hidden />
      <p className="wc-note-eyebrow text-xs font-black uppercase tracking-[0.12em]">
        {chest.carriedOver ? t("note_title_carried") : t("note_title")}
      </p>
      <ul className="wc-hand wc-note-lines mt-1 font-bold">
        {lines.map((line) => (
          <li key={line.key}>{t(line.key, line.values)}</li>
        ))}
      </ul>
      <p className="mt-1 flex items-center justify-end gap-2">
        {premium ? <MaskDoodle /> : <GlassesDoodle />}
        <span className="wc-hand text-2xl font-bold">{t("note_sign")}</span>
      </p>
    </div>
  );
}

/**
 * Under the note: the Coin that came with the chest (celebrated once, with the shared chime), the
 * grant still waiting on the earning cap, or, with the economy off, Puhu promising next Monday.
 */
export function ChestSceneReward({
  chest,
  celebrate,
  reduceMotion,
}: {
  chest: WeeklyChestView;
  celebrate: boolean;
  reduceMotion: boolean;
}) {
  const t = useTranslations("weeklyChest");
  const reward = chest.rewardPendingMessage || !chest.reward?.amount ? null : chest.reward;
  const coin = reward?.unit === "COIN";

  useEffect(() => {
    if (celebrate && coin) void playCoinChime();
  }, [celebrate, coin]);

  if (chest.rewardPendingMessage) {
    return (
      <p className="max-w-xs text-center text-sm font-bold text-[var(--wc-body)]" role="status">
        {chest.rewardPendingMessage}
      </p>
    );
  }
  if (reward) {
    return (
      <div className={`flex flex-col items-center ${celebrate ? "wc-pop-in" : ""}`} role="status">
        {coin && celebrate ? (
          <CoinCelebrationVisual size="sm" reduceMotion={reduceMotion} />
        ) : coin ? (
          <Coins className="size-12 text-[var(--wc-gold)]" aria-hidden />
        ) : (
          <Sparkles className="size-12 text-[var(--wc-gold)]" aria-hidden />
        )}
        <p className="mt-1 text-4xl font-black text-[var(--wc-gold)]">
          {t("reward_amount", { amount: reward.amount, unit: reward.unit })}
        </p>
        <p className="text-sm font-bold text-[var(--wc-body)]">{t("reward_body")}</p>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-4 ${celebrate ? "wc-pop-in" : ""}`}>
      <PuhuImage variant="happy" size={84} className="shrink-0" />
      <p className="wc-bubble rounded-[var(--radius-card)] px-4 py-3 text-sm font-extrabold">{t("off_bubble")}</p>
    </div>
  );
}

/** Puhu's glasses, scribbled next to the signature. */
function GlassesDoodle() {
  return (
    <svg viewBox="0 0 44 18" className="h-4 w-10 text-[var(--wc-ink)]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="10" r="7" />
      <circle cx="33" cy="10" r="7" />
      <path d="M18 9c2-2 6-2 8 0" />
    </svg>
  );
}

/** Premium Puhu signs with the hero mask, the same outline as the premium mark (cropped to the mask). */
function MaskDoodle() {
  return (
    <svg viewBox="1 5 22 13" className="h-4 w-7 text-[var(--wc-ink)]" aria-hidden focusable="false">
      <path fill="currentColor" fillRule="evenodd" d={PREMIUM_MASK_PATH} />
    </svg>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CoachMemoryDto } from "@mentor/types";
import { clearCoachMemory, fetchCoachMemory } from "@/lib/coach";

/**
 * Legacy saved coach summary with an explicit deletion control (KVKK).
 * Renders nothing until a profile exists (new users see no footprint).
 */
export function CoachMemoryCard() {
  const t = useTranslations("coach.memory");
  const [memory, setMemory] = useState<CoachMemoryDto | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCoachMemory()
      .then((m) => {
        if (active) setMemory(m);
      })
      .catch(() => {
        // Memory unavailable (offline, ai disabled) — just don't show the card.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!memory) return null;

  async function reset() {
    setClearing(true);
    try {
      await clearCoachMemory();
      setMemory(null);
    } catch {
      setClearing(false);
    }
  }

  return (
    <div
      className="rounded-[var(--radius-card)] bg-white/90 px-4 py-3 shadow-[var(--shadow-card)]"
      style={{ color: "var(--color-main)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">{t("title")}</p>
        <button
          type="button"
          onClick={() => void reset()}
          disabled={clearing}
          className="min-h-8 shrink-0 cursor-pointer text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ color: "var(--color-secondary)" }}
        >
          {t("reset")}
        </button>
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
        {t("legacy_notice")}
      </p>
      <p
        className="mt-1 whitespace-pre-wrap text-[13px]"
        style={{ color: "var(--color-secondary)" }}
      >
        {memory.summary}
      </p>
    </div>
  );
}

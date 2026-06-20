"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { CoachAccessDto, GhostComparisonDto, GhostNarrationDto } from "@mentor/types";
import { aiChatControllerGetAccess, aiGhostControllerNarrate } from "@mentor/api-client";
import { Card, Chip, SectionHeading } from "@mentor/ui";

/**
 * "Geçmiş-ben" (ghost) — the latest attempt vs the user's OWN past (§0 no ranking). Free reads the
 * rule-based comparison (backend-localized headline + signed deltas + record badge); premium users
 * additionally get an AI progress narration (`POST /v1/coach/ghost-narration`, cached per attempt).
 */
export function GhostCard({ ghost }: { ghost: GhostComparisonDto }) {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("ghost");
  const router = useRouter();
  const [premium, setPremium] = useState<boolean | null>(null);
  const [narration, setNarration] = useState<string | null>(ghost.aiNarration);
  const [narrating, setNarrating] = useState(false);

  const generate = useCallback(async () => {
    setNarrating(true);
    try {
      const res = (await aiGhostControllerNarrate()) as unknown as
        | { data?: GhostNarrationDto }
        | GhostNarrationDto;
      const dto = (res as { data?: GhostNarrationDto }).data ?? (res as GhostNarrationDto);
      if (dto?.narration) setNarration(dto.narration);
    } catch {
      /* Narration is a premium enhancement; fall back to the rule-based comparison. */
    } finally {
      setNarrating(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    aiChatControllerGetAccess()
      .then((res) => {
        if (!active) return;
        const access =
          (res as unknown as { data?: CoachAccessDto }).data ?? (res as unknown as CoachAccessDto);
        const isPremium = access?.mode === "PREMIUM";
        setPremium(isPremium);
        // Generate only when premium and this attempt has no cached narration yet.
        if (isPremium && ghost.aiNarration == null) void generate();
      })
      .catch(() => {
        if (active) setPremium(false);
      });
    return () => {
      active = false;
    };
  }, [generate, ghost.aiNarration]);

  const movers = ghost.subjects.filter((s) => s.delta && s.delta !== "0.00");

  return (
    <Card className="flex flex-col gap-3">
      <SectionHeading as="h2" subtitle={translate("subtitle")}>
        {translate("title")}
      </SectionHeading>

      <p className="text-sm" style={{ color: "var(--color-body)" }}>
        {ghost.headline}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {ghost.latest.totalNet}
        </span>
        <Chip>{translate("previous_delta", { delta: ghost.previousDelta })}</Chip>
        <Chip>
          {ghost.isNewRecord
            ? translate("new_record")
            : translate("record_delta", { delta: ghost.recordDelta })}
        </Chip>
      </div>

      {movers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("by_subject")}
          </span>
          {movers.map((s) => (
            <span
              key={s.subjectRef}
              className="rounded-[var(--radius-card)] px-2 py-1 text-xs tabular-nums"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-chip) 25%, transparent)",
                color: "var(--color-chip-text)",
              }}
            >
              {s.subjectName} {s.delta}
            </span>
          ))}
        </div>
      )}

      {narrating ? (
        <p className="text-sm" role="status" style={{ color: "var(--color-secondary)" }}>
          {translate("narrating")}
        </p>
      ) : premium && narration ? (
        <motion.div
          role="status"
          className="flex flex-col gap-2"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Chip>{translate("coach_chip")}</Chip>
          <p className="text-sm" style={{ color: "var(--color-body)" }}>
            {narration}
          </p>
        </motion.div>
      ) : premium === false ? (
        <button
          type="button"
          onClick={() => router.push("/abonelik")}
          className="text-left text-sm underline"
          style={{ color: "var(--color-secondary)" }}
        >
          {translate("premium_nudge")}
        </button>
      ) : null}
    </Card>
  );
}

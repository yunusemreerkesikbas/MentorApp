"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { GhostComparisonDto, GhostNarrationDto } from "@mentor/types";
import { aiGhostControllerNarrate } from "@mentor/api-client";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";

interface GhostCardProps {
  examId: string;
  ghost: GhostComparisonDto;
  premium: boolean;
}

/**
 * "Geçmiş-ben" compares the latest attempt with the user's own past.
 * Premium narration remains scoped to the same active exam.
 */
export function GhostCard({ examId, ghost, premium }: GhostCardProps) {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("ghost");
  const router = useRouter();
  const [narration, setNarration] = useState<string | null>(ghost.aiNarration);
  const [narrating, setNarrating] = useState(false);

  const generate = useCallback(async () => {
    setNarrating(true);
    try {
      const res = (await aiGhostControllerNarrate({ examId })) as unknown as
        | { data?: GhostNarrationDto }
        | GhostNarrationDto;
      const dto =
        (res as { data?: GhostNarrationDto }).data ??
        (res as GhostNarrationDto);
      if (dto?.narration) setNarration(dto.narration);
    } catch {
      /* Premium enhancement: the rule-based comparison remains available. */
    } finally {
      setNarrating(false);
    }
  }, [examId]);

  useEffect(() => {
    if (premium && ghost.aiNarration == null) void generate();
  }, [generate, ghost.aiNarration, premium]);

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeading as="h2" subtitle={translate("subtitle")}>
        {translate("title")}
      </SectionHeading>

      <p className="text-sm" style={{ color: "var(--color-body)" }}>
        {ghost.headline}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{
            color: "var(--color-main)",
            fontFamily: "var(--font-heading)",
          }}
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

      <div className="overflow-hidden rounded-[var(--radius-card)]">
        <div
          className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-xs font-semibold"
          style={{
            background: "color-mix(in srgb, var(--color-chip) 12%, white)",
            color: "var(--color-secondary)",
          }}
        >
          <span>{translate("by_subject")}</span>
          <span>{translate("latest_net")}</span>
          <span>{translate("change")}</span>
        </div>
        <ul className="flex flex-col">
          {ghost.subjects.map((subject) => {
            const improved = subject.delta != null && Number(subject.delta) > 0;
            return (
              <li
                key={subject.subjectRef}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t px-3 py-2 text-sm"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--color-main) 8%, transparent)",
                }}
              >
                <span style={{ color: "var(--color-body)" }}>
                  {subject.subjectName}
                </span>
                <span
                  className="tabular-nums"
                  style={{ color: "var(--color-main)" }}
                >
                  {subject.latestNet}
                </span>
                <span
                  className="min-w-12 text-right font-semibold tabular-nums"
                  style={{
                    color: improved
                      ? "var(--color-success)"
                      : "var(--color-secondary)",
                  }}
                >
                  {subject.delta ?? "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {narrating ? (
        <p
          className="text-sm"
          role="status"
          style={{ color: "var(--color-secondary)" }}
        >
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
      ) : !premium ? (
        <button
          type="button"
          onClick={() => router.push("/abonelik")}
          className="min-h-11 text-left text-sm underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-secondary)" }}
        >
          {translate("premium_nudge")}
        </button>
      ) : null}
    </Card>
  );
}





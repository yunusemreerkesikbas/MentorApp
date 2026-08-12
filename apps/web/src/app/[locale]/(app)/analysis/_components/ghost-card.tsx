"use client";

import { useTranslations } from "next-intl";
import type { GhostComparisonDto } from "@mentor/types";
import { Card, Chip, SectionHeading } from "@mentor/ui";

interface GhostCardProps {
  ghost: GhostComparisonDto;
}

/** "Geçmiş-ben" compares the latest attempt with the user's own past. */
export function GhostCard({ ghost }: GhostCardProps) {
  const translate = useTranslations("ghost");

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeading as="h2">{translate("title")}</SectionHeading>

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
        <Chip>
          {translate("previous_delta", { delta: ghost.previousDelta })}
        </Chip>
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
    </Card>
  );
}

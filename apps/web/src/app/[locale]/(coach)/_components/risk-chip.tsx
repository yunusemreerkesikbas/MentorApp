"use client";

import { useTranslations } from "next-intl";
import type { MentorshipRiskFlagId } from "@mentor/types";
import { Chip } from "@mentor/ui";

/**
 * A triage flag. Colour carries meaning here, so each chip also states its reason in the title
 * and in visually-hidden text — a coach reading with a screen reader gets the same triage.
 */
export function RiskChip({ flag }: { flag: MentorshipRiskFlagId }) {
  const t = useTranslations("mentorship");
  const hint = t(`flag_${flag}_hint`);
  return (
    <span title={hint}>
      {/* `normal-case`: Chip title-cases by default, which turns "Plan aksıyor" into a label that
          reads like a bug in Turkish. These are sentences about a person, not tag names. */}
      <Chip size="sm" className="normal-case">
        {t(`flag_${flag}`)}
      </Chip>
      <span className="sr-only"> {hint}</span>
    </span>
  );
}

/** Empty state for the flag row: a student with nothing wrong should read as "on track". */
export function NoRiskChip() {
  const t = useTranslations("mentorship");
  return (
    <span style={{ color: "var(--color-secondary)" }} className="text-xs">
      {t("flag_none")}
    </span>
  );
}

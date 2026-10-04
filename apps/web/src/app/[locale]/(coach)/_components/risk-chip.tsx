"use client";

import { useTranslations } from "next-intl";
import { MentorshipRiskFlag, type MentorshipRiskFlagId } from "@mentor/types";
import { SignalPill, type SignalHue } from "./signal-pill";

/**
 * Which hue names which signal. Identity, not rank — the roster is already sorted worst-first,
 * so hue only has to answer "which signal", which hue does well and ordering does badly.
 *
 * Exported because the round path paints its nodes' dots from the same map, and two copies of
 * it would be two places for the round and the rows to disagree about what orange means.
 */
export const RISK_FLAG_HUE: Record<MentorshipRiskFlagId, SignalHue> = {
  [MentorshipRiskFlag.INACTIVE]: "--sig-inactive",
  [MentorshipRiskFlag.LOW_MOOD]: "--sig-mood",
  [MentorshipRiskFlag.NET_DROP]: "--sig-net",
  [MentorshipRiskFlag.PLAN_SLIPPING]: "--sig-plan",
};

/**
 * A triage flag. Colour carries meaning here, so each pill also states its reason in the title
 * and in visually-hidden text — a coach reading with a screen reader gets the same triage.
 */
export function RiskChip({ flag }: { flag: MentorshipRiskFlagId }) {
  const t = useTranslations("mentorship");
  const hint = t(`flag_${flag}_hint`);
  return (
    <span>
      <SignalPill hue={RISK_FLAG_HUE[flag]} title={hint}>
        {t(`flag_${flag}`)}
      </SignalPill>
      <span className="sr-only"> {hint}</span>
    </span>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipBriefDeltaDto,
  MentorshipBriefMetricChangeDto,
  MentorshipRiskFlagId,
} from "@mentor/types";
import { CalmLabel } from "../../../_components/signal-pill";
import { RiskChip } from "../../../_components/risk-chip";
import {
  formatCount,
  formatDate,
  formatMood,
  formatNet,
  formatRate,
} from "../../../_components/mentorship-format";

/**
 * "What has moved since the last brief I read?" — the band above the brief text (APP-093).
 *
 * Everything here is rule-computed by `mentorship/domain/brief-delta.ts` and arrives ready to
 * render: the API already did every subtraction, so this file formats numbers and never derives
 * them (`docs/standards/frontend.md`). A percentage the band worked out for itself would be a
 * second place for the panel and the model to disagree about what changed.
 *
 * Only ARRIVED flags wear the triage vocabulary. A cleared flag is not a finding about the
 * student any more, so it reads as {@link CalmLabel} instead, and the metric and coach-action
 * rows wear no signal dots at all: the shell's four hues answer "which signal", and a completion
 * rate or a task count is not one. Lending them a hue would undo exactly what `signal-pill.tsx`
 * was written to fix.
 */
export function BriefDeltaBand({ delta }: { delta: MentorshipBriefDeltaDto }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();

  return (
    <div
      className="flex flex-col gap-2 rounded-[var(--radius-card)] px-3 py-2.5"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-secondary) 7%, transparent)" }}
    >
      <p className="text-xs font-semibold" style={{ color: "var(--color-main)" }}>
        {t("brief_delta_title")}{" "}
        <span className="font-normal" style={{ color: "var(--color-secondary)" }}>
          {t("brief_delta_since", {
            date: formatDate(delta.previousGeneratedAt, locale),
          })}
        </span>
      </p>

      {delta.quiet ? (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("brief_delta_quiet")}
        </p>
      ) : (
        <>
          <FlagRow added={delta.flagsAdded} resolved={delta.flagsResolved} />
          <MetricRow delta={delta} locale={locale} />
          <ActionRow delta={delta} />
        </>
      )}
    </div>
  );
}

function FlagRow({
  added,
  resolved,
}: {
  added: MentorshipRiskFlagId[];
  resolved: MentorshipRiskFlagId[];
}) {
  const t = useTranslations("mentorship");
  if (added.length === 0 && resolved.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {added.map((flag) => (
        <RiskChip key={`added-${flag}`} flag={flag} />
      ))}
      {resolved.map((flag) => (
        <CalmLabel key={`resolved-${flag}`}>
          {t("brief_flag_resolved", { flag: t(`flag_${flag}`) })}
        </CalmLabel>
      ))}
    </div>
  );
}

/** `previous → current`, because a coach reading "%40 → %72" needs no second sentence. */
function MetricRow({
  delta,
  locale,
}: {
  delta: MentorshipBriefDeltaDto;
  locale: string;
}) {
  const t = useTranslations("mentorship");
  const rate = (value: number) => formatRate(value, locale) ?? "";
  const count = (value: number) => formatCount(value, locale);

  const moves: { key: string; label: string; text: string }[] = [];
  const push = (
    key: string,
    change: MentorshipBriefMetricChangeDto | null,
    format: (value: number) => string,
  ) => {
    if (!change) return;
    moves.push({
      key,
      label: t(`brief_metric_${key}`),
      text: `${format(change.previous)} → ${format(change.current)}`,
    });
  };

  push("plan", delta.planCompletion, rate);
  push("active_days", delta.activeDays7d, count);
  push("focus", delta.focusMinutes7d, count);
  push("sessions", delta.sessions7d, count);
  push("net", delta.net, (value) => formatNet(value, locale) ?? "");
  push("mood", delta.moodMean, (value) => formatMood(value, locale) ?? "");

  if (delta.mocksSince > 0) {
    moves.push({
      key: "mocks",
      label: "",
      text: t("brief_metric_mocks", { count: delta.mocksSince }),
    });
  }

  if (moves.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]" style={{ color: "var(--color-body)" }}>
      {moves.map((move) => (
        <li key={move.key}>
          {move.label ? `${move.label} ` : ""}
          <b className="font-semibold tabular-nums" style={{ color: "var(--color-main)" }}>
            {move.text}
          </b>
        </li>
      ))}
    </ul>
  );
}

/**
 * What the COACH did in between, addressed to them as "sen" like the rest of this surface.
 *
 * Counts only, and never a claim that they caused anything: the copy says what happened after,
 * not because of. The same rule the v2 prompt is given, kept on the screen beside it.
 */
function ActionRow({ delta }: { delta: MentorshipBriefDeltaDto }) {
  const t = useTranslations("mentorship");
  const actions = delta.coachActions;
  const lines: string[] = [];

  if (actions.attended) lines.push(t("brief_action_attended"));
  if (actions.assignmentsScheduled > 0) {
    lines.push(
      t("brief_action_assignments_scheduled", { count: actions.assignmentsScheduled }),
    );
  }
  if (actions.assignmentsCompleted > 0) {
    lines.push(
      t("brief_action_assignments_completed", { count: actions.assignmentsCompleted }),
    );
  }
  if (actions.assignmentsDropped > 0) {
    lines.push(t("brief_action_assignments_dropped", { count: actions.assignmentsDropped }));
  }
  if (actions.followupsOpened > 0) {
    lines.push(t("brief_action_followups_opened", { count: actions.followupsOpened }));
  }
  if (actions.followupsClosed > 0) {
    lines.push(t("brief_action_followups_closed", { count: actions.followupsClosed }));
  }

  if (lines.length === 0) return null;
  return (
    <p className="text-[13px]" style={{ color: "var(--color-secondary)" }}>
      <span className="font-semibold" style={{ color: "var(--color-body)" }}>
        {t("brief_action_title")}
      </span>{" "}
      {lines.join(" · ")}
    </p>
  );
}

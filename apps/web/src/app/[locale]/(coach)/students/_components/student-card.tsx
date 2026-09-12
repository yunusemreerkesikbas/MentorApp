"use client";

import { useTranslations } from "next-intl";
import type { MentorshipRosterRowDto } from "@mentor/types";
import { Card } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import {
  formatDate,
  formatNet,
  formatRate,
  relativeDay,
} from "../../_components/mentorship-format";
import { NoRiskChip, RiskChip } from "../../_components/risk-chip";
import { AttentionButton, AttentionStatus } from "./attention-button";
import { worstFlag } from "./cohort-summary";

/**
 * One roster row.
 *
 * The card used to be three stacked bands — flags, metrics, then a suggestion, then a mark row —
 * so a list of them read as a wall. Now the row's one action sits on the same line as the one
 * sentence about it, under a single hairline: header, numbers, and a band that is only there
 * when there is something to do.
 *
 * A calm student gets no pill, no suggestion and no button. Nothing to do should read as nothing
 * to do, rather than as a row that merely happens to be further down the list.
 */
export function StudentCard({
  row,
  locale,
  clickable,
  busy = false,
  onAttention,
}: {
  row: MentorshipRosterRowDto;
  locale: string;
  clickable: boolean;
  busy?: boolean;
  /** Omitted on the history tab: an ended link has nothing left to attend to. */
  onAttention?: (attended: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  // `metrics` is null once the link ends: the coach's window onto this student is closed, and the
  // card shows only that the relationship existed.
  const metrics = row.metrics;
  const last = relativeDay(metrics?.lastActiveDate ?? null);
  const lastLabel =
    last.kind === "never"
      ? t("value_never")
      : last.kind === "today"
        ? t("value_today")
        : last.kind === "yesterday"
          ? t("value_yesterday")
          : t("value_days_ago", { count: last.days });
  const worst = worstFlag(row.riskFlags);

  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-bold" style={{ color: "var(--color-main)" }}>
          {row.studentDisplayName}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {row.riskFlags.length === 0 ? (
            <NoRiskChip />
          ) : (
            row.riskFlags.map((flag) => <RiskChip key={flag} flag={flag} />)
          )}
        </div>
      </div>
      {metrics ? (
        // Two columns on a phone: four at 358px would put each value under 80px and break
        // "6 gün önce" onto two lines.
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Metric label={t("metric_last_active")} value={lastLabel} />
          <Metric
            label={t("metric_focus_7d")}
            value={t("value_minutes", { count: metrics.focusMinutes7d })}
          />
          <Metric
            label={t("metric_plan_completion")}
            value={formatRate(metrics.planCompletionRate7d, locale) ?? t("value_none")}
          />
          <Metric
            label={t("metric_latest_net")}
            value={formatNet(metrics.latestMockNet, locale) ?? t("value_none")}
          />
        </dl>
      ) : (
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {row.endedAt
            ? t("ended_on", { date: formatDate(row.endedAt, locale) })
            : t("ended_no_access")}
        </p>
      )}
    </div>
  );

  /*
   * The band is offered only where there is something to attend to: a calm student needs no
   * button, and an ended link has no window left to look through.
   *
   * Its text slot carries the suggestion for the worst flag before the mark, and the readback
   * after it. One suggestion a coach acts on beats four they skim, and once they have acted the
   * suggestion is the wrong sentence to still be showing.
   */
  const band = onAttention && metrics && row.riskFlags.length > 0 && (
    <div
      className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 14%, transparent)" }}
    >
      {row.attendedAt !== null ? (
        <AttentionStatus attendedAt={row.attendedAt} />
      ) : (
        worst !== null && (
          <p className="m-0 text-sm" style={{ color: "var(--color-body)" }}>
            {t(`action_${worst}`)}
          </p>
        )
      )}
      <div className="w-full sm:w-fit sm:flex-none">
        <AttentionButton
          fullWidth
          attendedAt={row.attendedAt}
          busy={busy}
          onToggle={onAttention}
        />
      </div>
    </div>
  );

  // The Card is the outer element, not the Link: the button in the band has to sit OUTSIDE the
  // anchor (a button inside an anchor is invalid HTML), and wrapping the whole card would trap it.
  // An ended link is history — its report is closed, so nothing there looks clickable.
  return (
    <Card>
      <div
        className="flex flex-col gap-4"
        /*
         * Two different quiets. A handled student keeps every flag and number — only the emphasis
         * drops, so the eye lands on the rows still waiting. A calm one is dimmer still, because
         * there is nothing under it at all. Hiding either would be editing the worklist.
         */
        style={
          row.attendedAt !== null
            ? { opacity: 0.72 }
            : metrics !== null && row.riskFlags.length === 0
              ? { opacity: 0.82 }
              : undefined
        }
      >
        {clickable ? (
          <Link
            href={{ pathname: "/students/[studentId]", params: { studentId: row.studentId } }}
            className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {content}
          </Link>
        ) : (
          content
        )}
        {band}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs leading-snug" style={{ color: "var(--color-secondary)" }}>
        {label}
      </dt>
      <dd
        className="mt-0.5 text-[15px] font-semibold leading-snug tabular-nums"
        style={{ color: "var(--color-main)" }}
      >
        {value}
      </dd>
    </div>
  );
}

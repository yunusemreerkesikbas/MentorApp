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
import { AttentionButton } from "./attention-button";
import { worstFlag } from "./cohort-summary";

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold" style={{ color: "var(--color-main)" }}>
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
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
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
      {/* "Ne yapmalı", for the worst flag only: one suggestion a coach acts on beats four they
          skim. Plain text on purpose — the whole card is already a link to the report, where
          both the note field and the composer live, and an anchor inside an anchor is invalid. */}
      {worst !== null && metrics && (
        <p className="text-sm" style={{ color: "var(--color-body)" }}>
          {t(`action_${worst}`)}
        </p>
      )}
    </div>
  );

  // The mark is offered only where there is something to attend to. A calm student needs no
  // button, and an ended link has no window left to look through.
  const attention = onAttention && metrics && row.riskFlags.length > 0 && (
    <AttentionButton attendedAt={row.attendedAt} busy={busy} onToggle={onAttention} />
  );

  // The Card is the outer element, not the Link: the button below has to sit OUTSIDE the anchor
  // (a button inside an anchor is invalid HTML), and wrapping the whole card in one would trap it.
  // An ended link is history — its report is closed, so nothing there looks clickable.
  return (
    <Card>
      <div
        className="flex flex-col gap-3"
        // A handled student stays fully legible; only the emphasis drops, so the eye lands on the
        // rows still waiting. Hiding anything here would be editing the data, not the worklist.
        style={row.attendedAt !== null ? { opacity: 0.72 } : undefined}
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
        {attention}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {label}
      </dt>
      <dd className="text-sm font-medium" style={{ color: "var(--color-main)" }}>
        {value}
      </dd>
    </div>
  );
}

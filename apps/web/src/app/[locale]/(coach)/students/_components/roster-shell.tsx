"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipInviteCodeDto, MentorshipRosterRowDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, SectionHeading, Skeleton, SkeletonGroup } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { getPathname, Link } from "@/i18n/navigation";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchInviteCode, fetchRoster, rotateInviteCode } from "@/lib/mentorship";
import {
  formatDate,
  formatNet,
  formatRate,
  relativeDay,
} from "../../_components/mentorship-format";
import { NoRiskChip, RiskChip } from "../../_components/risk-chip";

type Tab = "ACTIVE" | "ENDED";

export function RosterShell() {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const toast = useMentorToast();
  const [tab, setTab] = useState<Tab>("ACTIVE");
  // The loaded tab travels with its rows, so switching tabs shows the skeleton without a
  // synchronous setState in the effect (which would cascade a render).
  const [loaded, setLoaded] = useState<{
    tab: Tab;
    items: MentorshipRosterRowDto[];
  } | null>(null);
  const [invite, setInvite] = useState<MentorshipInviteCodeDto | null>(null);
  const [inviteLoaded, setInviteLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const showError = useCallback(
    (err: unknown) => {
      toast.error({
        title: common("error_title"),
        // The API already localizes its messages; the client does not re-translate them.
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    },
    [toast, common],
  );

  useEffect(() => {
    let active = true;
    fetchRoster(tab)
      .then((page) => {
        if (active) setLoaded({ tab, items: page.items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoaded({ tab, items: [] });
        showError(err);
      });
    return () => {
      active = false;
    };
  }, [tab, showError]);

  const rows = loaded?.tab === tab ? loaded.items : null;

  useEffect(() => {
    let active = true;
    fetchInviteCode()
      .then((code) => {
        if (active) setInvite(code);
      })
      .catch(() => {
        /* The roster is the screen; a missing code panel must not blank it. */
      })
      .finally(() => {
        if (active) setInviteLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function rotate() {
    setBusy(true);
    try {
      setInvite(await rotateInviteCode());
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!invite) return;
    await copyToClipboard(invite.code, t("invite_copied"));
  }

  /**
   * The same code as a link the coach can paste into a message. `?code=` only fills the field in:
   * the invitation screen still asks the student to look up the code and confirm the data scope,
   * because clicking a link somebody sent is not consent.
   */
  async function copyInviteLink() {
    if (!invite) return;
    const path = getPathname({ href: "/coach-invitation", locale });
    await copyToClipboard(
      `${window.location.origin}${path}?code=${encodeURIComponent(invite.code)}`,
      t("invite_link_copied"),
    );
  }

  async function copyToClipboard(text: string, title: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success({ title });
    } catch {
      /* Clipboard can be blocked; the code is on screen to read either way. */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading subtitle={t("roster_subtitle")}>{t("roster_title")}</SectionHeading>

      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
            {t("invite_title")}
          </h2>
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {t("invite_body")}
          </p>
          {!inviteLoaded ? (
            <Skeleton className="h-10 w-64 rounded-[var(--radius-card)]" />
          ) : invite ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <code
                  className="rounded-[var(--radius-card)] px-3 py-2 text-sm font-semibold tracking-wide"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-main)",
                  }}
                >
                  {invite.code}
                </code>
                <Button variant="soft" onClick={copyCode}>
                  {t("invite_copy")}
                </Button>
                <Button variant="soft" onClick={copyInviteLink}>
                  {t("invite_copy_link")}
                </Button>
                <Button variant="ghost" busy={busy} onClick={rotate}>
                  {t("invite_rotate")}
                </Button>
              </div>
              <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
                {t("invite_expires", { date: formatDate(invite.expiresAt, locale) })}
                {" · "}
                {t("invite_rotate_warning")}
              </p>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("invite_none")}
              </span>
              <Button busy={busy} onClick={rotate}>
                {t("invite_create")}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <SegmentPillControl
        items={[
          { id: "ACTIVE", label: t("tab_active") },
          { id: "ENDED", label: t("tab_ended") },
        ]}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
        ariaLabel={t("roster_title")}
        layoutId="mentorship-roster-tabs"
      />

      <SkeletonGroup
        label={t("loading")}
        loading={rows === null}
        revealed={
          rows === null ? (
            <div className="flex flex-col gap-3" aria-hidden>
              <div className="h-28" />
              <div className="h-28" />
              <div className="h-28" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title={tab === "ACTIVE" ? t("roster_empty_title") : t("roster_ended_empty_title")}
              description={
                tab === "ACTIVE" ? t("roster_empty_body") : t("roster_ended_empty_body")
              }
              puhuVariant="encouraging"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li key={row.linkId}>
                  <StudentCard row={row} locale={locale} clickable={tab === "ACTIVE"} />
                </li>
              ))}
            </ul>
          )
        }
        className="flex flex-col gap-3"
      >
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    </div>
  );
}

function StudentCard({
  row,
  locale,
  clickable,
}: {
  row: MentorshipRosterRowDto;
  locale: string;
  clickable: boolean;
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

  const body = (
    <Card>
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
      </div>
    </Card>
  );

  // An ended link is history: its report is closed, so the card must not look clickable.
  return clickable ? (
    <Link
      href={{
        pathname: "/students/[studentId]",
        params: { studentId: row.studentId },
      }}
      className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
    >
      {body}
    </Link>
  ) : (
    body
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

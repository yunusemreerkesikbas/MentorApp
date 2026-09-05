"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipCoachOverviewDto, MentorshipRosterRowDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { SectionHeading, SkeletonGroup } from "@mentor/ui";
import { EmptyState } from "@/components/empty-state";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { useMentorToast } from "@/lib/mentor-toast";
import { fetchOverview, fetchRoster, rotateInviteCode } from "@/lib/mentorship";
import { CoachCapacityCard } from "./coach-capacity-card";
import { CoachScopeCard } from "./coach-scope-card";
import { summarizeCohort } from "./cohort-summary";
import { CohortSummaryCard } from "./cohort-summary-card";
import { RosterContentSkeleton } from "./roster-content-skeleton";
import { StudentCard } from "./student-card";

type Tab = "ACTIVE" | "ENDED";

/**
 * The coach's landing screen. It orchestrates two fetches and hands the rendering to the cards
 * below it; the summary band, the seat counter and the scope mirror are all read off data this
 * screen already has, so "who needs me / how is the group / can I take another student" is one
 * page load rather than three.
 */
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
  const [overview, setOverview] = useState<MentorshipCoachOverviewDto | null>(null);
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
    fetchOverview()
      .then((next) => {
        if (active) setOverview(next);
      })
      .catch(() => {
        /* The roster is the screen; a missing header must not blank it. */
      });
    return () => {
      active = false;
    };
  }, []);

  // Only the ACTIVE tab describes a live cohort. Summing the history tab would report on students
  // whose window is closed, and their `metrics` are null by design.
  const summary = useMemo(
    () => summarizeCohort(tab === "ACTIVE" && rows ? rows : []),
    [tab, rows],
  );

  async function rotate() {
    setBusy(true);
    try {
      const inviteCode = await rotateInviteCode();
      setOverview((prev) => (prev ? { ...prev, inviteCode } : prev));
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading subtitle={t("roster_subtitle")}>{t("roster_title")}</SectionHeading>

      {tab === "ACTIVE" && <CohortSummaryCard summary={summary} />}

      <CoachCapacityCard
        loaded={overview !== null}
        inviteCode={overview?.inviteCode ?? null}
        activeStudents={overview?.activeStudents ?? 0}
        maxActiveStudents={overview?.maxActiveStudents ?? 0}
        freeSeats={overview?.freeSeats ?? 0}
        paidSeats={overview?.paidSeats ?? 0}
        usedSeats={overview?.usedSeats ?? 0}
        sponsorshipEnabled={overview?.sponsorshipEnabled ?? false}
        busy={busy}
        onRotate={rotate}
      />

      {overview !== null && (
        // Open on the empty roster: that screen is the coach's first, and it is the one moment
        // they have nothing else to read.
        <CoachScopeCard scope={overview.dataScope} defaultOpen={summary.total === 0} />
      )}

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
        <RosterContentSkeleton />
      </SkeletonGroup>
    </div>
  );
}

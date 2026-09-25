"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipCohortBriefDto, MentorshipRosterRowDto } from "@mentor/types";
import { Skeleton } from "@mentor/ui";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { SegmentPillControl } from "@/components/segment-pill-control";
import { ActivityLegend } from "../../_components/activity-strip";
import { groupRoster } from "./coach-round-model";
import { EndedStudentRow, StudentRow } from "./student-row";

export type RosterTab = "ACTIVE" | "ENDED";

const EMPTY = "mt-4 text-body-sm text-[var(--color-secondary)]";

/**
 * Every student in one card of rows (DESIGN.md §6.1), grouped by what the coach owes them today.
 * Group labels carry no counts: the round's title already says how many wait, and each number has
 * one home. Groups come from the rows as loaded, so a row the coach just marked keeps its place;
 * only its mark and the round move.
 */
export function StudentsCard({
  tab,
  onTab,
  rows,
  live,
  today,
  brief,
  busyId,
  onMark,
}: {
  tab: RosterTab;
  onTab: (tab: RosterTab) => void;
  /** As loaded for `tab`; null while loading. */
  rows: MentorshipRosterRowDto[] | null;
  /** The row with the coach's optimistic mark applied. */
  live: (row: MentorshipRosterRowDto) => MentorshipRosterRowDto;
  today: string;
  brief: MentorshipCohortBriefDto | null;
  busyId: string | null;
  onMark: (studentId: string, attended: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  const groups = useMemo(
    () => (rows && tab === "ACTIVE" ? groupRoster(rows, today) : null),
    [rows, tab, today],
  );
  const whyById = useMemo(
    () => new Map((brief?.items ?? []).map((item) => [item.studentId, item.why])),
    [brief],
  );

  const group = (label: string, members: MentorshipRosterRowDto[]) =>
    members.length === 0 ? null : (
      <div className="mt-4 flex flex-col">
        <h3 className="text-caption font-extrabold text-[var(--color-secondary)]">{label}</h3>
        <ul className="mt-1 flex flex-col">
          {members.map((row) => (
            <StudentRow
              key={row.linkId}
              row={live(row)}
              aiWhy={whyById.get(row.studentId) ?? null}
              today={today}
              busy={busyId === row.studentId}
              onMark={onMark}
            />
          ))}
        </ul>
      </div>
    );

  return (
    <section
      id="ogrenciler"
      className={`${PANEL_CARD} flex scroll-mt-24 flex-col`}
      aria-labelledby="students-title"
      data-testid="students-card"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="students-title" className={PANEL_CARD_TITLE}>
          {t("students_title")}
        </h2>
        <SegmentPillControl
          items={[
            { id: "ACTIVE", label: t("tab_active") },
            { id: "ENDED", label: t("tab_ended") },
          ]}
          value={tab}
          onChange={(id) => onTab(id as RosterTab)}
          ariaLabel={t("roster_tabs_label")}
        />
      </div>

      {rows === null ? (
        <RowsSkeleton />
      ) : tab === "ENDED" ? (
        rows.length === 0 ? (
          <p className={EMPTY}>{t("roster_ended_empty_body")}</p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {rows.map((row) => (
              <EndedStudentRow key={row.linkId} row={row} />
            ))}
          </ul>
        )
      ) : rows.length === 0 ? (
        <p className={EMPTY}>{t("roster_empty_body")}</p>
      ) : (
        <>
          <div className="mt-4">
            <ActivityLegend title={t("activity_legend_title", { days: 14 })} />
          </div>
          {groups ? (
            <>
              {group(t("students_group_waiting"), groups.waiting)}
              {group(t("students_group_seen"), groups.seenToday)}
              {group(t("students_group_on_track"), groups.onTrack)}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

function RowsSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-4" aria-hidden>
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40 rounded-[var(--radius-card)]" />
            <Skeleton className="h-3 w-56 rounded-[var(--radius-card)]" />
          </div>
          <Skeleton className="hidden h-3 w-52 rounded-[var(--radius-card)] sm:block" />
        </div>
      ))}
    </div>
  );
}

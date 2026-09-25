"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button, Skeleton } from "@mentor/ui";
import {
  CoachFollowupsPanel,
  useCoachFollowups,
  type FollowupCompose,
} from "@/components/mentorship/coach-followups-card";
import { PANEL_GRID_CLASS, PANEL_HERO, PANEL_MAIN_CLASS } from "@/components/panel/panel-styles";
import { useWideLayout } from "@/components/panel/use-wide-layout";
import { useCloudTransitionReady } from "@/lib/cloud-transition";
import { todayInIstanbul } from "@/lib/date-time";
import { firstName } from "@/lib/greeting";
import { useSubscription } from "@/lib/subscription-context";
import { AssignTaskForm, type AssignDraft } from "./assign-task-form";
import { CoachPanel } from "./coach-panel";
import { FollowupCard } from "./followup-card";
import { MocksCard } from "./mocks-card";
import { MoodCard } from "./mood-card";
import { NoteCard } from "./note-card";
import { PlanCard } from "./plan-card";
import { initialPlanningState } from "./planning-state";
import { hasTrace } from "./report-format";
import { ReportHeader } from "./report-header";
import { RhythmCard } from "./rhythm-card";
import { useStudentBrief } from "./use-student-brief";
import { useStudentReport } from "./use-student-report";
import { useWeeklyReportCard } from "./use-weekly-report-card";
import { WeekHeroCard, WeekHeroSkeleton } from "./week-hero-card";
import { useReportDates } from "./use-report-dates";
import { WeeklyReportCard } from "./weekly-report-card";
import { WeeklyReportPanel } from "./weekly-report-panel";

type Panel = "plan" | "followups" | "weekly" | "archive";

const CARD_SKELETON = "h-48 rounded-[var(--radius-card)]";

/**
 * The coach's workspace for one student (DESIGN.md §6.1): the week leads, the standing facts sit in
 * the rail, the long jobs open in a side panel. The layout draws at once and each part shows its own
 * skeleton; the weekly report and the follow-ups load beside the report, not after it. Two columns
 * from 1280px, chosen in JS so DOM order is reading order: on a phone the note, the follow-ups and
 * the weekly card come right after the week.
 */
export function StudentReportShell({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const wide = useWideLayout();
  const today = todayInIstanbul();
  const { loading: subscriptionLoading } = useSubscription();
  const student = useStudentReport(studentId);
  const { report } = student;
  const followups = useCoachFollowups(studentId);
  const weekly = useWeeklyReportCard(studentId);
  const weeklyDates = useReportDates();
  const brief = useStudentBrief(studentId, report !== null && hasTrace(report));
  const [panel, setPanel] = useState<Panel | null>(null);
  const [compose, setCompose] = useState<FollowupCompose | null>(null);
  // Held here, not in the panels: a panel unmounts on close, and a half-built week or note must not.
  const [drafts, setDrafts] = useState<AssignDraft[]>([]);
  const [planning, setPlanning] = useState(initialPlanningState);
  const [assigning, setAssigning] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  useCloudTransitionReady(report !== null || student.error !== null);

  const closePanel = () => setPanel(null);
  const openFollowups = (next: FollowupCompose | null) => {
    setCompose(next);
    setPanel("followups");
  };
  const name = report ? firstName(report.studentDisplayName) : "";
  const preview = weekly.preview;

  const hero =
    report && !subscriptionLoading ? (
      <WeekHeroCard
        report={report}
        today={today}
        brief={brief.brief}
        briefBusy={brief.busy}
        onPlan={() => setPanel("plan")}
        onNote={() => setNoteDraft((draft) => draft ?? report.coachNote?.body ?? "")}
      />
    ) : (
      <WeekHeroSkeleton />
    );
  const note = report ? (
    <NoteCard
      studentId={studentId}
      name={name}
      note={report.coachNote}
      draft={noteDraft}
      onDraft={setNoteDraft}
      onSaved={(coachNote) => {
        student.setReport((prev) => (prev ? { ...prev, coachNote } : prev));
        setNoteDraft(null);
      }}
    />
  ) : (
    <Skeleton className="h-36 rounded-[var(--radius-card)]" />
  );
  const followupCard = (
    <FollowupCard
      resource={followups}
      onCreate={() => openFollowups({ replacesId: null })}
      onOpenHistory={() => openFollowups(null)}
    />
  );
  const weeklyCard = (
    <WeeklyReportCard
      weekly={weekly}
      joinedOn={
        report === null
          ? undefined
          : report.acceptedAt
            ? todayInIstanbul(new Date(report.acceptedAt))
            : null
      }
      onOpen={(archive) => setPanel(archive ? "archive" : "weekly")}
    />
  );
  const details = report ? (
    <>
      <RhythmCard report={report} today={today} />
      <MocksCard report={report} />
      <PlanCard report={report} today={today} />
      <MoodCard report={report} today={today} />
    </>
  ) : (
    <>
      <Skeleton className={CARD_SKELETON} />
      <Skeleton className={CARD_SKELETON} />
    </>
  );

  return (
    <>
      {/* Inert while a panel is open: the panel is modal to the report, not to the whole app. */}
      <main inert={panel !== null} className={PANEL_MAIN_CLASS}>
        <ReportHeader
          studentId={studentId}
          report={report}
          failed={student.error !== null}
          today={today}
          marking={student.marking}
          ending={student.ending}
          showArchive={weekly.archive.length > 0}
          onToggleAttention={(attended) => void student.toggleAttention(attended)}
          onOpenArchive={() => setPanel("archive")}
          onEndLink={() => void student.endLink()}
        />
        {student.error !== null ? (
          <ReportError error={student.error} onRetry={student.retry} />
        ) : wide ? (
          <div className={PANEL_GRID_CLASS}>
            <div className="flex min-w-0 flex-col gap-5">
              {hero}
              {details}
            </div>
            <aside className="flex min-w-0 flex-col gap-5" aria-label={t("report_actions_label")}>
              {note}
              {followupCard}
              {weeklyCard}
            </aside>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-5">
            {hero}
            {note}
            {followupCard}
            {weeklyCard}
            {details}
          </div>
        )}
      </main>

      <AnimatePresence>
        {panel === "plan" && report ? (
          <CoachPanel key="plan" title={t("report_plan_week")} subtitle={t("assign_body")} busy={assigning} onClose={closePanel}>
            <AssignTaskForm
              studentId={studentId}
              studentName={report.studentDisplayName}
              studentExamType={report.studentExamType}
              state={planning}
              onStateChange={setPlanning}
              drafts={drafts}
              onDraftsChange={setDrafts}
              busy={assigning}
              onBusyChange={setAssigning}
              onAssigned={() => {
                closePanel();
                student.reload();
              }}
              onCancel={closePanel}
            />
          </CoachPanel>
        ) : null}

        {panel === "followups" && followups.enabled === true ? (
          <CoachPanel
            key="followups"
            title={compose ? t("followup_create") : t("followup_history_title")}
            onClose={closePanel}
          >
            <CoachFollowupsPanel resource={followups} studentId={studentId} compose={compose} onCompose={setCompose} />
          </CoachPanel>
        ) : null}

        {(panel === "weekly" || panel === "archive") && preview ? (
          <WeeklyReportPanel
            key="weekly"
            studentId={studentId}
            report={weekly}
            period={weeklyDates.range(preview.snapshot.period.startDate, preview.snapshot.period.endDate)}
            archiveOpen={panel === "archive"}
            onClose={closePanel}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

/**
 * The report did not load: said in the hero's place. A refusal (the link ended, the student is not
 * this coach's) carries the server's own words and no retry; anything else can be asked again.
 */
function ReportError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("mentorship");
  const refused = error instanceof ApiClientError && (error.status === 403 || error.status === 404);
  return (
    <section className={PANEL_HERO} role="alert">
      <p className="text-body-sm font-semibold text-[var(--color-body)]">
        {refused ? error.message : t("report_load_failed")}
      </p>
      {refused ? null : (
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={onRetry}>
          {t("roster_retry")}
        </Button>
      )}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import {
  CoachFollowupsPanel,
  useCoachFollowups,
  type FollowupCompose,
} from "@/components/mentorship/coach-followups-card";
import { EmptyState } from "@/components/empty-state";
import { Link, useRouter } from "@/i18n/navigation";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { endStudentLink, fetchStudentReport, setAttention } from "@/lib/mentorship";
import { AssignTaskForm, type AssignDraft } from "./assign-task-form";
import { BriefCard } from "./brief-card";
import { CoachNoteCard } from "./coach-note-card";
import { CoachPanel } from "./coach-panel";
import { ReportActionBar, ReportActionRail, type ReportPanel } from "./report-action-rail";
import { ReportActivity } from "./report-activity";
import { ReportHeader } from "./report-header";
import { ReportMocks } from "./report-mocks";
import { ReportMood } from "./report-mood";
import { ReportPlan } from "./report-plan";
import { ReportWeekStrip } from "./report-week-strip";
import { StudentReportContentSkeleton } from "./student-report-content-skeleton";
import { WeeklyReportCard } from "./weekly-report-card";

/**
 * The coach's workspace for one student (design canvas approved 2026-09-13): the status on the
 * left, what the coach can do on the right, and the long jobs in a side panel.
 *
 * The old page stacked ten equal cards and put three forms above the numbers a coach needs before
 * writing anything. Now the numbers lead and the forms wait beside them. This file only
 * orchestrates: fetching, the optimistic attention mark, ending the link, and which panel is open.
 */
export function StudentReportShell({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const dialog = useMentorDialog();
  const router = useRouter();
  const [report, setReport] = useState<MentorshipStudentReportDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [marking, setMarking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<ReportPanel | null>(null);
  const [compose, setCompose] = useState<FollowupCompose | null>(null);
  // Held here, not in the composer: the panel unmounts on close, and a half-built week must not.
  const [drafts, setDrafts] = useState<AssignDraft[]>([]);
  // Started beside the report request, not after it: the two reads do not depend on each other.
  const followups = useCoachFollowups(studentId);

  const showError = useCallback(
    (err: unknown) => {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    },
    [toast, common],
  );

  const load = useCallback(() => {
    fetchStudentReport(studentId)
      .then(setReport)
      .catch((err: unknown) => {
        setFailed(true);
        showError(err);
      });
  }, [studentId, showError]);

  useEffect(load, [load]);

  const closePanel = useCallback(() => setPanel(null), []);
  const openFollowups = useCallback((next: FollowupCompose | null) => {
    setCompose(next);
    setPanel("followups");
  }, []);

  /**
   * Optimistic like the roster's: this is the coach's own act, and a round trip between deciding
   * and seeing it is the friction the mark exists to remove. On failure the row snaps back.
   */
  const toggleAttention = useCallback(
    async (attended: boolean) => {
      setMarking(true);
      const patch = (next: boolean) =>
        setReport((prev) =>
          prev === null
            ? prev
            : {
                ...prev,
                attendedAt: next ? new Date().toISOString() : null,
                needsAttention: !next && prev.riskFlags.length > 0,
              },
        );
      patch(attended);
      try {
        await setAttention(studentId, attended);
      } catch (err) {
        patch(!attended);
        showError(err);
      } finally {
        setMarking(false);
      }
    },
    [studentId, showError],
  );

  async function endLink() {
    if (!report) return;
    const confirmed = await dialog.confirm({
      title: t("report_end_confirm_title"),
      message: t("report_end_confirm_body", { name: report.studentDisplayName }),
      confirmLabel: t("report_end_confirm_action"),
      cancelLabel: t("confirm_cancel"),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await endStudentLink(studentId);
      router.replace("/students");
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <EmptyState
        title={t("guard_title")}
        description={t("guard_body")}
        puhuVariant="encouraging"
        action={
          <Link href="/students">
            <Button variant="secondary">{t("report_back")}</Button>
          </Link>
        }
      />
    );
  }

  if (!report) return <StudentReportContentSkeleton />;

  const followupsEnabled = followups.enabled !== false;

  return (
    <>
      {/* Inert while a panel is open: the panel is modal to the report, not to the whole app. */}
      <div inert={panel !== null} className="flex flex-col gap-6 pb-24 xl:pb-0">
        <ReportHeader
          report={report}
          marking={marking}
          ending={busy}
          onToggleAttention={(attended) => void toggleAttention(attended)}
          onEndLink={() => void endLink()}
        />
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-7">
            {/* Keyed: moving between students must remount this, or a brief about one could be
                read under another's name while a stale request is still in flight. */}
            <BriefCard key={studentId} studentId={studentId} />
            <WeeklyReportCard key={`weekly-${studentId}`} studentId={studentId} />
            <ReportWeekStrip tasks={report.planTasks} />
            <ReportActivity report={report} />
            <ReportPlan report={report} />
            <ReportMocks report={report} />
            <ReportMood report={report} />
          </div>
          <ReportActionRail
            report={report}
            followups={followups}
            onNoteSaved={load}
            onCreateFollowup={() => openFollowups({ replacesId: null })}
            onOpenHistory={() => openFollowups(null)}
            onPlanWeek={() => setPanel("plan")}
          />
        </div>
        <ReportActionBar
          followupsEnabled={followupsEnabled}
          onOpen={(next) => (next === "followups" ? openFollowups(null) : setPanel(next))}
        />
      </div>

      <AnimatePresence>
        {panel === "plan" ? (
          <CoachPanel
            key="plan"
            title={t("report_plan_week")}
            subtitle={t("assign_body")}
            onClose={closePanel}
          >
            <AssignTaskForm
              studentId={studentId}
              studentName={report.studentDisplayName}
              studentExamType={report.studentExamType}
              previousTasks={report.planTasks}
              drafts={drafts}
              onDraftsChange={setDrafts}
              onAssigned={() => {
                closePanel();
                load();
              }}
              onCancel={closePanel}
            />
          </CoachPanel>
        ) : null}

        {panel === "note" ? (
          <CoachPanel key="note" title={t("note_title")} onClose={closePanel}>
            <CoachNoteCard
              inPanel
              studentId={studentId}
              note={report.coachNote}
              onSaved={() => {
                closePanel();
                load();
              }}
            />
          </CoachPanel>
        ) : null}

        {panel === "followups" && followupsEnabled ? (
          <CoachPanel
            key="followups"
            title={compose ? t("followup_create") : t("followup_history_title")}
            onClose={closePanel}
          >
            <CoachFollowupsPanel
              resource={followups}
              studentId={studentId}
              compose={compose}
              onCompose={setCompose}
            />
          </CoachPanel>
        ) : null}
      </AnimatePresence>
    </>
  );
}

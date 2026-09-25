"use client";
import { useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipProgramTemplateDto } from "@mentor/types";
import { createMentorshipAssignmentsSchema } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import {
  CoachOverlayBody,
  CoachOverlayFooter,
} from "@/components/coach-overlay";
import { PANEL_QUIET_BUTTON } from "@/components/mentorship/coach-ui";
import { todayInIstanbul } from "@/lib/date-time";
import { firstName } from "@/lib/greeting";
import { useMentorToast } from "@/lib/mentor-toast";
import { assignTasks } from "@/lib/mentorship";
import { PlanningComposer } from "./planning-composer";
import { PlanningDraftList } from "./planning-draft-list";
import { PlanningSources } from "./planning-sources";
import { PlanningWeek } from "./planning-week";
import { buildTemplateDrafts } from "./template-apply";
import { TemplateSave, useProgramTemplates } from "./template-bar";
import { usePlanningTasks } from "./use-planning-tasks";
import {
  MAX_DRAFTS,
  MAX_DAYS_AHEAD,
  assignmentInput,
  composerMode,
  hasUnsavedInput,
  monday,
  shiftDate,
  type AssignDraft,
  type PlanningState,
} from "./planning-state";
export type { AssignDraft } from "./planning-state";

/**
 * "Haftayı planla" (canvas "Panel · Haftayı planla"): the week and its days, what the chosen day
 * already holds, an always-open task form, the program being composed, and where a program can
 * start from. One filled button, the send at the foot; everything else is a text action.
 */
export function AssignTaskForm({
  studentId,
  studentName,
  studentExamType,
  drafts,
  onDraftsChange: setDrafts,
  state,
  onStateChange: setState,
  busy,
  onBusyChange: setBusy,
  onAssigned,
  onCancel,
}: {
  studentId: string;
  studentName: string;
  studentExamType: string | null;
  drafts: readonly AssignDraft[];
  onDraftsChange: Dispatch<SetStateAction<AssignDraft[]>>;
  state: PlanningState;
  onStateChange: Dispatch<SetStateAction<PlanningState>>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onAssigned: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const locked = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useProgramTemplates();
  const data = usePlanningTasks(studentId, state.week);
  const today = todayInIstanbul();
  const limit = shiftDate(today, MAX_DAYS_AHEAD);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(state.week, i));
  const counts = new Map(
    days.map((day) => [day, drafts.filter((d) => d.taskDate === day).length]),
  );
  const existingCounts =
    data.rows === null
      ? undefined
      : new Map(
          days.map((day) => [
            day,
            data.rows!.filter((d) => d.taskDate === day).length,
          ]),
        );
  const mode = composerMode(state.editor, drafts);
  const unsaved = hasUnsavedInput(state.editor, drafts);
  const payload = drafts.map(assignmentInput);
  const valid =
    createMentorshipAssignmentsSchema.safeParse({ tasks: payload }).success &&
    drafts.every((d) => d.taskDate >= today && d.taskDate <= limit);

  function showWeek(week: string) {
    setState((s) => ({
      ...s,
      week,
      day: week === monday(today) ? today : week,
    }));
  }
  function loadTemplate(template: MentorshipProgramTemplateDto) {
    if (locked.current) return;
    if (drafts.length + template.tasks.length > MAX_DRAFTS) {
      toast.info({ title: t("planning_capacity", { max: MAX_DRAFTS }) });
      return;
    }
    const load = buildTemplateDrafts(
      template,
      state.week,
      studentExamType,
      MAX_DRAFTS - drafts.length,
    );
    setDrafts((prev) => [
      ...prev,
      ...load.drafts.map((d) => ({ ...d, key: crypto.randomUUID() })),
    ]);
    if (load.clearedTopics)
      toast.info({
        title: t("template_loaded", { name: template.name }),
        message: t("template_topics_cleared", { count: load.clearedTopics }),
      });
  }
  /** "Taslağa ekle" or "Değişikliği kaydet": the form's task joins (or updates) the program. */
  function commitEditor() {
    const editor = state.editor;
    if (!editor || locked.current) return;
    setDrafts((prev) =>
      prev.some((d) => d.key === editor.key)
        ? prev.map((d) => (d.key === editor.key ? editor : d))
        : [...prev, editor],
    );
    setState((s) => ({
      ...s,
      editor: null,
      week: monday(editor.taskDate),
      day: editor.taskDate,
    }));
  }
  function editDraft(draft: AssignDraft) {
    setState((s) => ({ ...s, editor: { ...draft } }));
    // The draft now sits in the form above the list: take the keyboard there with it.
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || unsaved || locked.current || busy) return;
    locked.current = true;
    setBusy(true);
    try {
      await assignTasks(studentId, payload);
      toast.success({
        title: t("assign_done_title"),
        message: t("assign_done_body", {
          name: studentName,
          count: drafts.length,
        }),
      });
      setDrafts([]);
      setState((s) => ({ ...s, copied: [] }));
      onAssigned();
    } catch (err) {
      toast.error({
        title: common("error_title"),
        message:
          err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <CoachOverlayBody>
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6 pb-4">
          <PlanningWeek
            state={state}
            setState={setState}
            drafts={drafts}
            today={today}
            limit={limit}
            days={days}
            counts={counts}
            existingCounts={existingCounts}
            data={data}
            showWeek={showWeek}
          />
          <PlanningComposer
            draft={state.editor}
            mode={mode}
            day={state.day}
            dirty={unsaved}
            examType={studentExamType}
            studentName={firstName(studentName)}
            titleRef={titleRef}
            onChange={(editor) => setState((s) => ({ ...s, editor }))}
            onCommit={commitEditor}
            onReset={() => setState((s) => ({ ...s, editor: null }))}
          />
          <PlanningDraftList
            drafts={drafts}
            setDrafts={setDrafts}
            editingKey={mode === "edit" ? state.editor!.key : null}
            editLocked={unsaved}
            onEdit={editDraft}
            today={today}
            limit={limit}
            footer={
              <TemplateSave
                templates={templates}
                setTemplates={setTemplates}
                drafts={drafts}
                examType={studentExamType}
                disabled={busy}
              />
            }
          />
          <PlanningSources
            studentId={studentId}
            target={state.week}
            count={drafts.length}
            copied={state.copied}
            onCopy={(added, keys) => {
              setDrafts((prev) => [...prev, ...added]);
              setState((s) => ({ ...s, copied: [...s.copied, ...keys] }));
            }}
            templates={templates}
            canLoad={!busy && drafts.length < MAX_DRAFTS}
            onLoad={loadTemplate}
            onPendingChange={setBusy}
          />
        </fieldset>
      </CoachOverlayBody>
      <CoachOverlayFooter>
        {unsaved ? (
          // Its own line: the two actions stay together below it.
          <p className="basis-full text-caption font-semibold text-[var(--color-secondary)]">
            {t("planning_unsaved")}
          </p>
        ) : null}
        <button type="button" className={`${PANEL_QUIET_BUTTON} px-2`} disabled={busy} onClick={onCancel}>
          {t("confirm_cancel")}
        </button>
        <Button type="submit" busy={busy} disabled={!valid || unsaved}>
          {t("assign_action", { count: drafts.length })}
        </Button>
      </CoachOverlayFooter>
    </form>
  );
}

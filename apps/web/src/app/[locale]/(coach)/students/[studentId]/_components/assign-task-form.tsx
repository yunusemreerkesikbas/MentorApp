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
import { useMentorToast } from "@/lib/mentor-toast";
import { assignTasks } from "@/lib/mentorship";
import { todayInIstanbul } from "@/lib/date-time";
import { PlanningWeek } from "./planning-week";
import { PlanningDraftList } from "./planning-draft-list";
import {
  SuggestButton,
  TemplateLoadSelect,
  TemplateSaveRow,
  useProgramTemplates,
} from "./template-bar";
import { buildTemplateDrafts } from "./template-apply";
import { PlanningEditor } from "./planning-editor";
import { PlanningSource } from "./planning-source";
import { usePlanningTasks } from "./use-planning-tasks";
import {
  MAX_DRAFTS,
  assignmentInput,
  MAX_DAYS_AHEAD,
  monday,
  shiftDate,
  type AssignDraft,
  type PlanningState,
} from "./planning-state";
export type { AssignDraft } from "./planning-state";

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
  function saveEditor() {
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
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || state.editor || locked.current || busy) return;
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
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5 pb-4">
          <PlanningWeek
            state={state}
            setState={setState}
            today={today}
            limit={limit}
            days={days}
            counts={counts}
            existingCounts={existingCounts}
            data={data}
            showWeek={showWeek}
          />
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            disabled={
              drafts.length >= MAX_DRAFTS ||
              !!state.editor ||
              state.day < today ||
              state.day > limit
            }
            onClick={() =>
              setState((s) => ({
                ...s,
                editor: {
                  key: crypto.randomUUID(),
                  taskDate: s.day,
                  title: "",
                  subject: null,
                  topic: null,
                  coachNote: null,
                },
              }))
            }
          >
            {t("assign_add_to_day")}
          </Button>
          {state.editor && (
            <PlanningEditor
              draft={state.editor}
              examType={studentExamType}
              onChange={(editor) => setState((s) => ({ ...s, editor }))}
              onSave={saveEditor}
              onCancel={() => setState((s) => ({ ...s, editor: null }))}
            />
          )}
          <PlanningDraftList
            drafts={drafts}
            setDrafts={setDrafts}
            state={state}
            setState={setState}
            today={today}
            limit={limit}
          />
          <fieldset
            disabled={!!state.editor}
            className="flex min-w-0 flex-col gap-4"
          >
            <PlanningSource
              studentId={studentId}
              target={state.week}
              count={drafts.length}
              copied={state.copied}
              onAdd={(added, keys) => {
                setDrafts((prev) => [...prev, ...added]);
                setState((s) => ({ ...s, copied: [...s.copied, ...keys] }));
              }}
            />
            <TemplateLoadSelect
              templates={templates}
              disabled={busy || drafts.length >= MAX_DRAFTS}
              onLoad={loadTemplate}
            />
            <SuggestButton
              studentId={studentId}
              onPendingChange={setBusy}
              disabled={busy || drafts.length >= MAX_DRAFTS}
              onLoad={loadTemplate}
            />
            <TemplateSaveRow
              templates={templates}
              setTemplates={setTemplates}
              drafts={drafts}
              examType={studentExamType}
              disabled={busy}
            />
          </fieldset>
        </fieldset>
      </CoachOverlayBody>
      <CoachOverlayFooter>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          {t("confirm_cancel")}
        </Button>
        <Button type="submit" busy={busy} disabled={!valid || !!state.editor}>
          {t("assign_action", { count: drafts.length })}
        </Button>
      </CoachOverlayFooter>
    </form>
  );
}

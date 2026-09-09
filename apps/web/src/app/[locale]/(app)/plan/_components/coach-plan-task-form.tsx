"use client";

import { useState } from "react";
import { ApiClientError } from "@mentor/api-client";
import type { CoachPlanGroupedTaskDto, MentorshipRosterRowDto } from "@mentor/types";
import { Button, TextAreaField, TextField } from "@mentor/ui";
import {
  createMentorshipBatchAssignmentSchema,
  createPlanTaskSchema,
  updateMentorshipAssignmentGroupSchema,
  updateMentorshipAssignmentSchema,
  updatePlanTaskSchema,
} from "@mentor/validation";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form";
import {
  buildCoachTaskCreate,
  buildCoachTaskUpdate,
  type CoachTaskMutationTarget,
} from "@/lib/coach-plan-mutations";
import {
  assignTasksBatch,
  updateAssignment,
  updateAssignmentGroup,
} from "@/lib/mentorship";
import { useMentorToast } from "@/lib/mentor-toast";
import { createPlanTask, updatePlanTask } from "@/lib/plan-tasks";
import { CoachPlanAttendees } from "./coach-plan-attendees";
import { CoachPlanFormPanel } from "./coach-plan-form-panel";
import { CoachPlanTimeFields } from "./coach-plan-form-fields";

type TaskFormMode =
  | { kind: "CREATE"; initialDate: string }
  | {
      kind: "EDIT";
      task: CoachPlanGroupedTaskDto;
      target: CoachTaskMutationTarget;
    };

export function CoachPlanTaskForm({
  mode,
  roster,
  onClose,
  onSuccess,
}: {
  mode: TaskFormMode;
  roster: readonly MentorshipRosterRowDto[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const t = useTranslations("coachPlan");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const editing = mode.kind === "EDIT";
  const initialTask = editing ? mode.task : null;
  const initialAttendees = initialTask?.participants.map((person) => person.studentId) ?? [];
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [taskDate, setTaskDate] = useState(
    initialTask?.taskDate ?? (mode.kind === "CREATE" ? mode.initialDate : ""),
  );
  const [startTime, setStartTime] = useState(initialTask?.startTime ?? "");
  const [endTime, setEndTime] = useState(initialTask?.endTime ?? "");
  const [coachNote, setCoachNote] = useState(initialTask?.coachNote ?? "");
  const [attendeeIds, setAttendeeIds] = useState(initialAttendees);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const personalEdit = editing && mode.target.kind === "PERSONAL";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode.kind === "CREATE") {
        const create = buildCoachTaskCreate({
          title,
          taskDate,
          startTime,
          endTime,
          coachNote,
          attendeeIds,
        });
        if (create.kind === "PERSONAL") {
          const input = createPlanTaskSchema.parse(create.input);
          await createPlanTask(input);
        } else {
          const input = createMentorshipBatchAssignmentSchema.parse(create.input);
          await assignTasksBatch(input);
        }
      } else {
        const input = buildCoachTaskUpdate(mode.target, {
          title,
          taskDate,
          startTime,
          endTime,
          coachNote,
        });
        if (mode.target.kind === "PERSONAL") {
          await updatePlanTask(
            mode.target.taskId,
            updatePlanTaskSchema.parse(input),
          );
        } else if (mode.target.kind === "ASSIGNMENT") {
          await updateAssignment(
            mode.target.studentId,
            mode.target.taskId,
            updateMentorshipAssignmentSchema.parse(input),
          );
        } else {
          await updateAssignmentGroup(
            mode.target.assignmentGroupId,
            updateMentorshipAssignmentGroupSchema.parse(input),
          );
        }
      }
      onSuccess(t(editing ? "task_updated" : "task_created"));
    } catch (failure) {
      const message = failure instanceof ApiClientError
        ? failure.message
        : isValidationError(failure)
          ? t("validation_error")
          : common("error_unknown");
      setError(message);
      toast.error({ title: common("error_title"), message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <CoachPlanFormPanel
      title={t(editing ? "edit_task" : "new_task")}
      busy={busy}
      onClose={onClose}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <TextField
          label={t("form_title")}
          value={title}
          required
          minLength={1}
          maxLength={200}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          type="date"
          label={t("form_date")}
          value={taskDate}
          required
          disabled={busy || personalEdit}
          onChange={(event) => setTaskDate(event.target.value)}
        />
        {personalEdit && (
          <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {t("personal_task_date_fixed")}
          </p>
        )}
        <CoachPlanTimeFields
          startTime={startTime}
          endTime={endTime}
          disabled={busy}
          onStartTime={setStartTime}
          onEndTime={setEndTime}
        />
        <CoachPlanAttendees
          roster={roster}
          selectedIds={attendeeIds}
          readOnly={editing}
          onChange={setAttendeeIds}
        />
        {(attendeeIds.length > 0 || (editing && !personalEdit)) && (
          <TextAreaField
            label={t("coach_note_optional")}
            value={coachNote}
            maxLength={500}
            rows={3}
            disabled={busy}
            onChange={(event) => setCoachNote(event.target.value)}
          />
        )}
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {t("form_cancel")}
          </Button>
          <Button type="submit" busy={busy}>
            {t(editing ? "save_changes" : "create_task")}
          </Button>
        </div>
      </form>
    </CoachPlanFormPanel>
  );
}

function isValidationError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ZodError",
  );
}

import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  PlanEventMutationScope,
  type CoachPlanEventDto,
  type CoachPlanGroupedTaskDto,
  type CoachPlanItemDto,
  type MentorshipRosterRowDto,
} from "@mentor/types";
import { MENTORSHIP_COACH_NOTE_MAX } from "@mentor/validation";
import { haptics } from "../../../lib/haptics.js";
import {
  assignTasksBatch,
  cancelCoachPlanEvent,
  createCoachPlanEvent,
  removeAssignment,
  removeAssignmentGroup,
  updateAssignment,
  updateAssignmentGroup,
  updateCoachPlanEvent,
} from "../../../lib/mentorship-plan-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { FormSheet } from "../../panel/primitives.js";
import { AppText, Button, Chip, ConfirmDialog, TextField } from "../../ui/index.js";

export type CoachPlanModal =
  | { kind: "TASK_CREATE"; date: string }
  | { kind: "EVENT_CREATE"; date: string }
  | { kind: "TASK_EDIT"; task: CoachPlanGroupedTaskDto }
  | { kind: "EVENT_EDIT"; event: CoachPlanEventDto }
  | { kind: "DETAIL"; item: CoachPlanItemDto };

export function CoachPlanSheets({
  modal,
  roster,
  onClose,
  onChanged,
  onOpenEdit,
}: {
  modal: CoachPlanModal | null;
  roster: MentorshipRosterRowDto[];
  onClose: () => void;
  onChanged: () => void;
  onOpenEdit: (next: CoachPlanModal) => void;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  if (!modal) return null;

  if (modal.kind === "DETAIL") {
    const detailItem = modal.item;
    const isTask = detailItem.kind === "TASK";
    const title = detailItem.kind === "TASK" ? detailItem.task.title : detailItem.event.title;
    const participants =
      detailItem.kind === "TASK"
        ? detailItem.task.participants.map((p) => p.studentDisplayName)
        : detailItem.event.attendees.map((a) => a.studentDisplayName);

    async function handleDeleteTask() {
      if (detailItem.kind !== "TASK") return;
      const task = detailItem.task;
      setBusy(true);
      try {
        if (task.participants.length > 1 && task.assignmentGroupId) {
          await removeAssignmentGroup(task.assignmentGroupId, {
            studentIds: task.participants.map((p) => p.studentId),
            expectedSignature: {
              taskDate: task.taskDate,
              title: task.title,
              subject: task.subject,
              topic: task.topic,
              startTime: task.startTime,
              endTime: task.endTime,
              durationMinutes: task.durationMinutes ?? null,
              coachNote: task.coachNote,
            },
          });
        } else if (task.participants[0]) {
          await removeAssignment(task.participants[0].studentId, task.participants[0].taskId);
        }
        void haptics.success();
        onChanged();
      } catch (err) {
        toast.show(extractMentorshipError(err, tCommon("error_body")));
      } finally {
        setBusy(false);
      }
    }

    async function handleCancelEvent() {
      if (detailItem.kind !== "EVENT") return;
      setBusy(true);
      try {
        await cancelCoachPlanEvent(detailItem.event.id, {
          scope: PlanEventMutationScope.OCCURRENCE,
        });
        void haptics.success();
        onChanged();
      } catch (err) {
        toast.show(extractMentorshipError(err, tCommon("error_body")));
      } finally {
        setBusy(false);
      }
    }

    return (
      <>
        <FormSheet
          visible
          title={title}
          closeLabel={tCommon("close")}
          closeDisabled={busy}
          onClose={onClose}
        >
          <AppText variant="caption" tone="secondary">
            {detailItem.kind === "TASK"
              ? `${detailItem.task.taskDate}${detailItem.task.subject ? ` · ${detailItem.task.subject}` : ""}`
              : `${detailItem.event.eventDate}${detailItem.event.startTime ? ` · ${detailItem.event.startTime}` : ""}`}
          </AppText>
          {participants.length > 0 ? (
            <AppText variant="body">
              {t("coach_plan_participants", { names: participants.join(", ") })}
            </AppText>
          ) : null}
          {detailItem.kind === "TASK" && detailItem.task.coachNote ? (
            <AppText variant="caption" tone="coach">
              {detailItem.task.coachNote}
            </AppText>
          ) : null}
          {detailItem.kind === "EVENT" && detailItem.event.description ? (
            <AppText variant="body">{detailItem.event.description}</AppText>
          ) : null}
          <View style={styles.btnRow}>
            <Button
              label={t("planning_edit")}
              variant="secondary"
              disabled={busy}
              onPress={() =>
                onOpenEdit(
                  detailItem.kind === "TASK"
                    ? { kind: "TASK_EDIT", task: detailItem.task }
                    : { kind: "EVENT_EDIT", event: detailItem.event },
                )
              }
              style={{ flex: 1 }}
            />
            <Button
              label={isTask ? t("template_delete_action") : t("followup_cancel")}
              variant="danger"
              loading={busy}
              onPress={() => setConfirmCancelOpen(true)}
              style={{ flex: 1 }}
            />
          </View>
        </FormSheet>
        <ConfirmDialog
          visible={confirmCancelOpen}
          title={isTask ? t("coach_plan_delete_task_title") : t("coach_plan_cancel_event_title")}
          message={t("coach_plan_confirm_irreversible")}
          confirmLabel={isTask ? t("template_delete_action") : t("followup_cancel")}
          cancelLabel={t("cancel_preview_cta")}
          destructive
          onCancel={() => setConfirmCancelOpen(false)}
          onConfirm={() => {
            setConfirmCancelOpen(false);
            if (isTask) void handleDeleteTask();
            else void handleCancelEvent();
          }}
        />
      </>
    );
  }

  return (
    <CoachPlanFormSheet
      modal={modal}
      roster={roster}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function CoachPlanFormSheet({
  modal,
  roster,
  onClose,
  onChanged,
}: {
  modal: Exclude<CoachPlanModal, { kind: "DETAIL" }>;
  roster: MentorshipRosterRowDto[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const isEvent = modal.kind === "EVENT_CREATE" || modal.kind === "EVENT_EDIT";
  const isEdit = modal.kind === "TASK_EDIT" || modal.kind === "EVENT_EDIT";

  const initialDate =
    modal.kind === "TASK_EDIT"
      ? modal.task.taskDate
      : modal.kind === "EVENT_EDIT"
        ? modal.event.eventDate
        : modal.date;

  const [title, setTitle] = useState(() =>
    modal.kind === "TASK_EDIT"
      ? modal.task.title
      : modal.kind === "EVENT_EDIT"
        ? modal.event.title
        : "",
  );
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(() =>
    modal.kind === "TASK_EDIT"
      ? (modal.task.startTime ?? "")
      : modal.kind === "EVENT_EDIT"
        ? (modal.event.startTime ?? "16:00")
        : isEvent
          ? "16:00"
          : "",
  );
  const [endTime, setEndTime] = useState(() =>
    modal.kind === "TASK_EDIT"
      ? (modal.task.endTime ?? "")
      : modal.kind === "EVENT_EDIT"
        ? (modal.event.endTime ?? "16:45")
        : isEvent
          ? "16:45"
          : "",
  );
  const [note, setNote] = useState(() =>
    modal.kind === "TASK_EDIT"
      ? (modal.task.coachNote ?? "")
      : modal.kind === "EVENT_EDIT"
        ? (modal.event.description ?? "")
        : "",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (modal.kind === "TASK_EDIT") return modal.task.participants.map((p) => p.studentId);
    if (modal.kind === "EVENT_EDIT") return modal.event.attendees.map((a) => a.studentId);
    return roster[0] ? [roster[0].studentId] : [];
  });
  const [busy, setBusy] = useState(false);

  const selectableStudents = roster.filter((r) => r.seat !== "NONE");

  const toggleStudent = (id: string) => {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  };

  async function submit() {
    if (!title.trim() || selectedIds.length === 0 || busy) return;
    setBusy(true);
    try {
      const cleanStart = startTime.trim() || null;
      const cleanEnd = cleanStart && endTime.trim() ? endTime.trim() : null;
      if (modal.kind === "TASK_CREATE") {
        await assignTasksBatch({
          studentIds: selectedIds,
          task: {
            title: title.trim(),
            taskDate: date,
            startTime: cleanStart,
            endTime: cleanEnd,
            coachNote: note.trim() || null,
          },
        });
      } else if (modal.kind === "TASK_EDIT") {
        const patch = {
          title: title.trim(),
          taskDate: date,
          startTime: cleanStart,
          endTime: cleanEnd,
          coachNote: note.trim() || null,
        };
        if (modal.task.participants.length > 1 && modal.task.assignmentGroupId) {
          await updateAssignmentGroup(modal.task.assignmentGroupId, {
            studentIds: modal.task.participants.map((p) => p.studentId),
            expectedSignature: {
              taskDate: modal.task.taskDate,
              title: modal.task.title,
              subject: modal.task.subject,
              topic: modal.task.topic,
              startTime: modal.task.startTime,
              endTime: modal.task.endTime,
              durationMinutes: modal.task.durationMinutes ?? null,
              coachNote: modal.task.coachNote,
            },
            ...patch,
          });
        } else if (modal.task.participants[0]) {
          await updateAssignment(
            modal.task.participants[0].studentId,
            modal.task.participants[0].taskId,
            patch,
          );
        }
      } else if (modal.kind === "EVENT_CREATE") {
        await createCoachPlanEvent({
          title: title.trim(),
          description: note.trim() || null,
          eventDate: date,
          startTime: cleanStart,
          endTime: cleanEnd,
          attendeeIds: selectedIds,
          recurrence: null,
        });
      } else if (modal.kind === "EVENT_EDIT") {
        await updateCoachPlanEvent(modal.event.id, {
          scope: PlanEventMutationScope.OCCURRENCE,
          title: title.trim(),
          description: note.trim() || null,
          eventDate: date,
          startTime: cleanStart,
          endTime: cleanEnd,
          attendeeIds: selectedIds,
        });
      }
      void haptics.success();
      onChanged();
    } catch (err) {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet
      visible
      title={
        isEvent
          ? t(isEdit ? "coach_plan_edit_event" : "coach_plan_new_event")
          : t(isEdit ? "coach_plan_edit_task" : "coach_plan_new_task")
      }
      closeLabel={tCommon("close")}
      closeDisabled={busy}
      onClose={onClose}
    >
      <TextField
        label={t("homework_title_label")}
        value={title}
        onChangeText={setTitle}
        maxLength={200}
      />
      <TextField
        label={t("planning_date")}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        maxLength={10}
      />
      <View style={styles.btnRow}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t("coach_plan_start_time")}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="HH:MM"
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t("coach_plan_end_time")}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="HH:MM"
            maxLength={5}
          />
        </View>
      </View>
      <TextField
        label={isEvent ? t("coach_plan_event_desc") : t("homework_note_label")}
        value={note}
        onChangeText={setNote}
        maxLength={MENTORSHIP_COACH_NOTE_MAX}
        multiline
      />
      {!isEdit || isEvent ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">
            {t("coach_plan_select_students")}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {selectableStudents.map((stu) => (
              <Chip
                key={stu.studentId}
                label={stu.studentDisplayName}
                selected={selectedIds.includes(stu.studentId)}
                tone="coach"
                onPress={() => toggleStudent(stu.studentId)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <Button
        label={t("profile_edit_save")}
        disabled={!title.trim() || selectedIds.length === 0}
        loading={busy}
        onPress={() => void submit()}
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  btnRow: { flexDirection: "row", gap: 8 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
});

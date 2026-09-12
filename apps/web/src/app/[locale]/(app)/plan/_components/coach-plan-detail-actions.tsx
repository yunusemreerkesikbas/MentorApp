"use client";

import { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ApiClientError } from "@mentor/api-client";
import type { CoachPlanItemDto, PlanEventMutationScope } from "@mentor/types";
import { Button } from "@mentor/ui";
import { useTranslations } from "next-intl";
import {
  eventMutationScope,
  isCoachEventMutable,
  taskMutationTarget,
  type CoachTaskMutationTarget,
} from "@/lib/coach-plan-mutations";
import { restoreCoachPlanTrigger } from "@/lib/coach-plan-calendar";
import { todayInIstanbul } from "@/lib/date-time";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  cancelCoachPlanEvent,
  removeAssignment,
  removeAssignmentGroup,
} from "@/lib/mentorship";
import { deletePlanTask } from "@/lib/plan-tasks";
import { CoachPlanEventScopeChoices } from "./coach-plan-event-scope";
import { CoachPlanFormPanel } from "./coach-plan-form-panel";

export function CoachPlanDetailActions({
  item,
  onEdit,
  onSuccess,
}: {
  item: CoachPlanItemDto;
  onEdit: (
    trigger: HTMLButtonElement,
    target: CoachTaskMutationTarget | null,
  ) => void;
  onSuccess: (message: string) => void;
}) {
  const t = useTranslations("coachPlan");
  const common = useTranslations("common");
  const dialog = useMentorDialog();
  const toast = useMentorToast();
  const [busy, setBusy] = useState(false);
  const [scopePrompt, setScopePrompt] = useState(false);
  const [scope, setScope] = useState<PlanEventMutationScope | null>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const taskTarget = item.kind === "TASK" ? taskMutationTarget(item.task) : null;
  const mutable = item.kind === "TASK"
    ? taskTarget !== null
    : isCoachEventMutable(item.event, todayInIstanbul());

  if (!mutable) return null;

  function closeScopePrompt() {
    setScopePrompt(false);
    setScope(null);
    requestAnimationFrame(() => cancelTriggerRef.current?.focus());
  }

  async function removeTask() {
    if (item.kind !== "TASK" || !taskTarget) return;
    const confirmed = await dialog.confirm({
      title: t("remove_task_title"),
      message: t("remove_task_body"),
      confirmLabel: t("remove_task"),
      cancelLabel: t("form_cancel"),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      if (taskTarget.kind === "PERSONAL") {
        await deletePlanTask(taskTarget.taskId);
      } else if (taskTarget.kind === "ASSIGNMENT") {
        await removeAssignment(taskTarget.studentId, taskTarget.taskId);
      } else {
        await removeAssignmentGroup(taskTarget.assignmentGroupId, {
          studentIds: taskTarget.studentIds,
          expectedSignature: taskTarget.expectedSignature,
        });
      }
      onSuccess(t("task_removed"));
    } catch (failure) {
      toast.error({
        title: common("error_title"),
        message: failure instanceof ApiClientError
          ? failure.message
          : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function cancelEvent(selected: PlanEventMutationScope | null) {
    if (item.kind !== "EVENT") return;
    const effectiveScope = eventMutationScope(item.event.seriesId, selected);
    if (!effectiveScope) return;
    if (scopePrompt) setScopePrompt(false);
    setScope(null);
    const trigger = cancelTriggerRef.current;
    const confirmed = await dialog.confirm({
      title: t("cancel_event_title"),
      message: t("cancel_event_body"),
      confirmLabel: t("cancel_event"),
      cancelLabel: t("form_cancel"),
    });
    requestAnimationFrame(() => restoreCoachPlanTrigger(trigger));
    if (!confirmed) return;
    setBusy(true);
    try {
      await cancelCoachPlanEvent(item.event.id, { scope: effectiveScope });
      onSuccess(t("event_cancelled"));
    } catch (failure) {
      toast.error({
        title: common("error_title"),
        message: failure instanceof ApiClientError
          ? failure.message
          : common("error_unknown"),
      });
    } finally {
      setBusy(false);
      setScope(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={(event) => onEdit(event.currentTarget, taskTarget)}
        >
          {t("edit")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          busy={busy}
          onClick={(event) => {
            if (item.kind === "TASK") {
              void removeTask();
            } else {
              cancelTriggerRef.current = event.currentTarget;
              if (item.event.seriesId) setScopePrompt(true);
              else void cancelEvent("OCCURRENCE");
            }
          }}
        >
          {t(item.kind === "TASK" ? "remove" : "cancel")}
        </Button>
      </div>
      <AnimatePresence>
      {scopePrompt ? (
        <CoachPlanFormPanel
          key="event-scope"
          title={t("event_scope")}
          busy={busy}
          onClose={closeScopePrompt}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("cancel_scope_body")}
            </p>
            <CoachPlanEventScopeChoices value={scope} onChange={setScope} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeScopePrompt}>
                {t("form_cancel")}
              </Button>
              <Button type="button" disabled={!scope} onClick={() => void cancelEvent(scope)}>
                {t("continue")}
              </Button>
            </div>
          </div>
        </CoachPlanFormPanel>
      ) : null}
      </AnimatePresence>
    </>
  );
}

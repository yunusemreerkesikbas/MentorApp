"use client";

import type { CoachPlanItemDto, MentorshipRosterRowDto } from "@mentor/types";
import type { CoachTaskMutationTarget } from "@/lib/coach-plan-mutations";
import { CoachPlanEventForm } from "./coach-plan-event-form";
import { CoachPlanTaskForm } from "./coach-plan-task-form";

export type CoachPlanOpenForm =
  | { kind: "TASK_CREATE"; initialDate: string }
  | { kind: "EVENT_CREATE"; initialDate: string }
  | {
      kind: "TASK_EDIT";
      task: Extract<CoachPlanItemDto, { kind: "TASK" }>["task"];
      target: CoachTaskMutationTarget;
    }
  | {
      kind: "EVENT_EDIT";
      event: Extract<CoachPlanItemDto, { kind: "EVENT" }>["event"];
    };

export function CoachPlanOpenFormPanel({
  form,
  roster,
  onClose,
  onCreationSuccess,
  onMutationSuccess,
}: {
  form: CoachPlanOpenForm;
  roster: readonly MentorshipRosterRowDto[];
  onClose: () => void;
  onCreationSuccess: (message: string) => void;
  onMutationSuccess: (message: string) => void;
}) {
  if (form.kind === "TASK_CREATE") {
    return (
      <CoachPlanTaskForm
        mode={{ kind: "CREATE", initialDate: form.initialDate }}
        roster={roster}
        onClose={onClose}
        onSuccess={onCreationSuccess}
      />
    );
  }
  if (form.kind === "TASK_EDIT") {
    return (
      <CoachPlanTaskForm
        mode={{ kind: "EDIT", task: form.task, target: form.target }}
        roster={roster}
        onClose={onClose}
        onSuccess={onMutationSuccess}
      />
    );
  }
  if (form.kind === "EVENT_CREATE") {
    return (
      <CoachPlanEventForm
        mode={{ kind: "CREATE", initialDate: form.initialDate }}
        roster={roster}
        onClose={onClose}
        onSuccess={onCreationSuccess}
      />
    );
  }
  return (
    <CoachPlanEventForm
      mode={{ kind: "EDIT", event: form.event }}
      roster={roster}
      onClose={onClose}
      onSuccess={onMutationSuccess}
    />
  );
}

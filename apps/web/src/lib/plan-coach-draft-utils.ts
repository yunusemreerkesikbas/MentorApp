import type { CoachPlanDraftDto } from "@mentor/types";
import type { BulkCreatePlanTasksInput } from "@mentor/validation";

export interface PlanCoachDraftRow {
  key: string;
  date: string;
  title: string;
  subject: string | null;
}

export function flattenCoachPlanDraft(
  draft: CoachPlanDraftDto,
): PlanCoachDraftRow[] {
  return draft.days.flatMap((day) =>
    day.tasks.map((task, index) => ({
      key: `${day.date}:${index}`,
      date: day.date,
      title: task.title,
      subject: task.subject,
    })),
  );
}

export function selectedDraftTasks(
  rows: PlanCoachDraftRow[],
  selected: ReadonlySet<string>,
): BulkCreatePlanTasksInput["tasks"] {
  return rows
    .filter((row) => selected.has(row.key))
    .map(({ date, title, subject }) => ({ taskDate: date, title, subject }));
}

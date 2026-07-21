import { createHash } from "node:crypto";

export interface PlanRevisionRow {
  id: string;
  taskDate: string;
  title: string;
  subject: string | null;
  status: string;
  sortOrder: number;
  updatedAt: Date;
}

export interface PlanAdaptationSnapshotTask {
  id: string;
  taskDate: string;
  title: string;
  subject: string | null;
  status: string;
  sortOrder: number;
}

export interface PlanAdaptationSnapshot {
  window: { from: string; to: string };
  planRevision: string;
  tasks: PlanAdaptationSnapshotTask[];
}

export const PLAN_ADAPTATION_WINDOW_DAYS = 7;

export function buildPlanRevision(rows: readonly PlanRevisionRow[]): string {
  const snapshot = rows
    .map((row) => ({
      id: row.id,
      taskDate: row.taskDate,
      title: row.title,
      subject: row.subject,
      status: row.status,
      sortOrder: row.sortOrder,
      updatedAt: row.updatedAt.toISOString(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

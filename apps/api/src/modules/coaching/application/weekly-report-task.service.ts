import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { CreateWeeklyReportTaskInput } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { todayInIstanbul } from "../domain/date.util";
import { CoachingEventTopic, PlanTaskCreated } from "../domain/coaching.events";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { WeeklyReportTaskRepository } from "../infrastructure/weekly-report-task.repository";
import { toPlanTaskDto } from "./coaching.mappers";

export interface WeeklyReportTaskEvidence {
  reportId: string;
  examId: string;
  weekStart: string;
  subjectRef: string | null;
  subjectName: string | null;
  baselineAverageNet: string | null;
}

@Injectable()
export class WeeklyReportTaskService {
  constructor(@Inject(DRIZZLE) private readonly db: Database, private readonly tasks: PlanTaskRepository,
    private readonly reports: WeeklyReportTaskRepository, private readonly events: EventEmitter2) {}

  async create(userId: string, input: CreateWeeklyReportTaskInput, evidence: WeeklyReportTaskEvidence) {
    const result = await withUserContext(this.db, { userId }, async (tx) => {
      await this.tasks.acquireUserLock(tx, userId);
      const old = await this.reports.find(tx, userId, evidence.reportId);
      if (old) return { task: toPlanTaskDto(old), created: false };
      const taskDate = input.taskDate ?? todayInIstanbul();
      if (taskDate < todayInIstanbul()) throw new DomainError(ErrorCode.COACHING_TASK_DATE_READONLY, HttpStatus.FORBIDDEN);
      const { reportId, subjectName, ...meta } = evidence;
      const row = await this.tasks.create(tx, { ...input, userId, taskDate, subject: subjectName,
        originType: "WEEKLY_REPORT", originRefId: reportId, originMeta: meta });
      return { task: toPlanTaskDto(row), created: true };
    });
    if (result.created) this.events.emit(CoachingEventTopic.PLAN_TASK_CREATED, new PlanTaskCreated(userId));
    return result.task;
  }

  find(userId: string, reportId: string) {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.reports.find(tx, userId, reportId);
      return row ? { task: toPlanTaskDto(row), createdAt: row.createdAt } : null;
    });
  }

  measure(userId: string, examId: string, subjectRef: string, after: Date, before: Date) {
    return withUserContext(this.db, { userId }, (tx) => this.reports.measurement(tx, userId, examId, subjectRef, after, before));
  }
}

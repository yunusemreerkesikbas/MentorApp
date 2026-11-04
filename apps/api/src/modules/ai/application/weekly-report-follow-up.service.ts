import { HttpStatus, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { WeeklyReportFollowUpDto } from "@mentor/types";
import type { CreateWeeklyReportTaskInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { WeeklyReportTaskService } from "../../coaching/application/weekly-report-task.service";
import { formatNetDelta } from "../../coaching/domain/net";
import { WeeklyRecapRepository } from "../infrastructure/weekly-recap.repository";

@Injectable()
export class WeeklyReportFollowUpService {
  constructor(private readonly reports: WeeklyRecapRepository, private readonly tasks: WeeklyReportTaskService,
    private readonly i18n: I18nService) {}

  private async owned(userId: string, reportId: string) {
    const row = await this.reports.byId(userId, reportId);
    if (!row || row.status !== "READY") throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return row;
  }

  async create(userId: string, reportId: string, input: CreateWeeklyReportTaskInput) {
    const row = await this.owned(userId, reportId);
    const suggestion = row.review.suggestedTask;
    if (!suggestion) throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
    const subjectRef = row.review.focus?.subjectRef ?? null;
    return this.tasks.create(userId, input, { reportId: row.id, examId: row.examId, weekStart: row.weekStart,
      subjectName: suggestion.subject, subjectRef,
      baselineAverageNet: row.review.deepAnalysis?.subjects.find((s) => s.subjectRef === subjectRef)?.averageNet ?? null });
  }

  async get(userId: string, reportId: string): Promise<WeeklyReportFollowUpDto> {
    const row = await this.owned(userId, reportId);
    const previousWeek = new Date(new Date(`${row.weekStart}T12:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const [current, previousReport] = await Promise.all([
      this.tasks.find(userId, row.id), this.reports.find(userId, row.examId, previousWeek),
    ]);
    const result: WeeklyReportFollowUpDto = { task: current?.task ?? null, previous: null };
    if (!previousReport || previousReport.status !== "READY") return result;
    const previousTask = await this.tasks.find(userId, previousReport.id);
    if (!previousTask) return result;
    const subjectRef = previousReport.review.focus?.subjectRef ?? null;
    const baselineNet = previousReport.review.deepAnalysis?.subjects.find((s) => s.subjectRef === subjectRef)?.averageNet ?? null;
    const measurement = subjectRef ? await this.tasks.measure(userId, row.examId, subjectRef, previousTask.createdAt,
      new Date(`${row.review.period.endDate}T21:00:00Z`)) : null;
    const messageKey = !subjectRef ? "WEEKLY_FOLLOW_UP_RHYTHM" : baselineNet === null ? "WEEKLY_FOLLOW_UP_NO_BASELINE"
      : measurement ? "WEEKLY_FOLLOW_UP_MEASURED" : "WEEKLY_FOLLOW_UP_WAITING";
    result.previous = { reportId: previousReport.id, weekStart: previousReport.weekStart, task: previousTask.task,
      baselineNet, measurement: measurement ? { net: measurement.net, takenAt: measurement.takenAt.toISOString(),
        delta: baselineNet === null ? null : formatNetDelta(Number(measurement.net) - Number(baselineNet)) } : null,
      message: this.i18n.translate(`coaching.weekly.${messageKey}`, { lang: I18nContext.current()?.lang ?? "tr" }) as string };
    return result;
  }
}

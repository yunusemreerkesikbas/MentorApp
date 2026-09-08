import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { PlanTaskDto } from "@mentor/types";
import type { CreateAnalysisPlanTaskInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import { AnalysisService } from "./analysis.service";
import { MockExamService } from "./mock-exam.service";
import { PlanService } from "./plan.service";

@Injectable()
export class AnalysisPlanTaskService {
  constructor(
    private readonly analysis: AnalysisService,
    private readonly mockExams: MockExamService,
    private readonly plan: PlanService,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
  ) {}

  async create(userId: string, input: CreateAnalysisPlanTaskInput): Promise<PlanTaskDto> {
    const baseline = await this.mockExams.getOwnedMockExam(
      userId,
      input.baselineMockExamId,
    );
    if (baseline.examId !== input.examId) this.focusChanged();

    const current = await this.analysis.getAnalysis(userId, input.examId);
    const focus = current.nextFocus;
    const currentBaselineId = focus?.recentTrend[0]?.mockExamId;
    if (
      !focus ||
      currentBaselineId !== input.baselineMockExamId ||
      focus.subjectRef !== input.expectedSubjectRef ||
      (focus.topicRef ?? null) !== (input.expectedTopicRef ?? null)
    ) {
      this.focusChanged();
    }

    const [subjects, topics] = await Promise.all([
      this.content.listExamSubjects(input.examId),
      this.content.listExamTopics(input.examId),
    ]);
    const subject = subjects.find((candidate) => candidate.slug === focus.subjectRef);
    const topic = focus.topicRef
      ? topics.find(
          (candidate) =>
            candidate.slug === focus.topicRef &&
            candidate.subjectSlug === focus.subjectRef,
        )
      : undefined;
    if (!subject || (focus.topicRef && !topic)) this.focusChanged();

    return this.plan.createFromAnalysis(userId, input, {
      subjectName: subject.name,
      ...(topic && { topicName: topic.name }),
      source: focus.source,
      evidenceCount: focus.evidenceCount,
    });
  }

  private focusChanged(): never {
    throw new DomainError(ErrorCode.ANALYSIS_FOCUS_CHANGED, HttpStatus.CONFLICT);
  }
}

import { Injectable } from "@nestjs/common";
import type { ContentPort, ExamCalendar, ExamRef, ExamSubjectRef, NetRule } from "../domain/content.port";
import { ContentService } from "../../content/application/content.service";

/**
 * W1 → W2 adapter: delegates coaching's {@link ContentPort} to the real ContentService.
 * Lives in coaching so content never imports coaching (correct dependency direction).
 */
@Injectable()
export class ContentServiceAdapter implements ContentPort {
  constructor(private readonly content: ContentService) {}

  async getExamCalendar(examType: string | null | undefined): Promise<ExamCalendar | null> {
    return this.content.getExamCalendarForCoaching(examType);
  }

  async getNetRule(examType: string | null | undefined): Promise<NetRule | null> {
    return this.content.getNetRuleByFamily(examType);
  }

  async getExamById(examId: string): Promise<ExamRef | null> {
    return this.content.getExamById(examId);
  }

  async listExamSubjects(examId: string): Promise<ExamSubjectRef[]> {
    return this.content.listExamSubjectsByExamId(examId);
  }
}

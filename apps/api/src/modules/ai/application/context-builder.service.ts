import { Injectable } from "@nestjs/common";
import { UsersService } from "../../identity/application/users.service";
import { ContentService } from "../../content/application/content.service";
import type { CoachContext } from "../domain/ai.constants";

/**
 * Assembles the PII-free grounding context for the AI coach (§4 #6): exam type + countdown only —
 * NO email/name/behavioral data. Reads other modules' PUBLIC services (workstreams §3). Streak/mood
 * grounding is deferred (coaching services aren't exported yet).
 */
@Injectable()
export class ContextBuilder {
  constructor(
    private readonly users: UsersService,
    private readonly content: ContentService,
  ) {}

  async build(userId: string): Promise<CoachContext> {
    const me = await this.users.getMe(userId);
    if (!me.examType) {
      return { examType: null, daysRemaining: null, examDateLabel: null };
    }
    const calendar = await this.content.getExamCalendarByFamily(me.examType).catch(() => null);
    return {
      examType: me.examType,
      daysRemaining: calendar?.daysRemaining ?? null,
      examDateLabel: calendar?.examDateLabel ?? null,
    };
  }
}

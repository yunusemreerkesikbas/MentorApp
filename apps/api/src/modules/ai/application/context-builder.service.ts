import { Injectable } from "@nestjs/common";
import { UsersService } from "../../identity/application/users.service";
import { ContentService } from "../../content/application/content.service";
import { MoodService } from "../../coaching/application/mood.service";
import type { CoachContext } from "../domain/ai.constants";

/**
 * Assembles the PII-free grounding context for the AI coach (§4 #6): exam type + countdown +
 * today's coarse mood signal (level + optional "zorlandığın konu") — NO email/name. Reads other
 * modules' PUBLIC services (workstreams §3); coaching now exports {@link MoodService}.
 */
@Injectable()
export class ContextBuilder {
  constructor(
    private readonly users: UsersService,
    private readonly content: ContentService,
    private readonly mood: MoodService,
  ) {}

  async build(userId: string): Promise<CoachContext> {
    const me = await this.users.getMe(userId);
    const today = await this.mood.getToday(userId).catch(() => null);
    const moodLevel = today?.mood ?? null;
    const struggleNote = today?.struggleNote ?? null;

    if (!me.examType) {
      return { examType: null, daysRemaining: null, examDateLabel: null, moodLevel, struggleNote };
    }
    const calendar = await this.content.getExamCalendarByFamily(me.examType).catch(() => null);
    return {
      examType: me.examType,
      daysRemaining: calendar?.daysRemaining ?? null,
      examDateLabel: calendar?.examDateLabel ?? null,
      moodLevel,
      struggleNote,
    };
  }
}

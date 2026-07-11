import { Injectable } from "@nestjs/common";
import { UsersService } from "../../identity/application/users.service";
import { ContentService } from "../../content/application/content.service";
import { MoodService } from "../../coaching/application/mood.service";
import { PlanService } from "../../coaching/application/plan.service";
import { SessionService } from "../../coaching/application/session.service";
import type { CoachContext } from "../domain/ai.constants";
import { CoachMemoryRepository } from "../infrastructure/coach-memory.repository";

/**
 * Assembles the PII-free grounding context for the AI coach (§4 #6): exam type + countdown +
 * today's coarse mood signal (level + optional "zorlandığın konu") + today's plan summary +
 * a rolling recent-session summary — NO email/name. Reads other modules' PUBLIC services
 * (workstreams §3); coaching exports {@link MoodService}, {@link PlanService}, {@link SessionService}.
 */
@Injectable()
export class ContextBuilder {
  constructor(
    private readonly users: UsersService,
    private readonly content: ContentService,
    private readonly mood: MoodService,
    private readonly plan: PlanService,
    private readonly sessions: SessionService,
    private readonly memory: CoachMemoryRepository,
  ) {}

  async build(userId: string): Promise<CoachContext> {
    const me = await this.users.getMe(userId);
    const [today, recentSessions, todayPlan, memory] = await Promise.all([
      this.mood.getToday(userId).catch(() => null),
      this.sessions.getRecentSummary(userId).catch(() => null),
      this.plan.getTodaySummary(userId).catch(() => null),
      this.memory.get(userId).catch(() => null),
    ]);
    const moodLevel = today?.mood ?? null;
    const struggleNote = today?.struggleNote ?? null;
    const memoryProfile = memory?.summary ?? null;

    if (!me.examType) {
      return {
        examType: null,
        daysRemaining: null,
        examDateLabel: null,
        moodLevel,
        struggleNote,
        recentSessions,
        todayPlan,
        memoryProfile,
      };
    }
    const calendar = await this.content.getExamCalendarByFamily(me.examType).catch(() => null);
    return {
      examType: me.examType,
      daysRemaining: calendar?.daysRemaining ?? null,
      examDateLabel: calendar?.examDateLabel ?? null,
      moodLevel,
      struggleNote,
      recentSessions,
      todayPlan,
      memoryProfile,
    };
  }
}

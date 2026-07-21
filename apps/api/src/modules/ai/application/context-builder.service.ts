import { Injectable } from "@nestjs/common";
import { UsersService } from "../../identity/application/users.service";
import { MoodService } from "../../coaching/application/mood.service";
import { PlanService } from "../../coaching/application/plan.service";
import { SessionService } from "../../coaching/application/session.service";
import type { CoachContext } from "../domain/ai.constants";

/** Builds the PII-free coaching context without official dates or cross-thread memory. */
@Injectable()
export class ContextBuilder {
  constructor(
    private readonly users: UsersService,
    private readonly mood: MoodService,
    private readonly plan: PlanService,
    private readonly sessions: SessionService,
  ) {}

  async build(userId: string): Promise<CoachContext> {
    const me = await this.users.getMe(userId);
    const [today, recentSessions, todayPlan] = await Promise.all([
      this.mood.getToday(userId).catch(() => null),
      this.sessions.getRecentSummary(userId).catch(() => null),
      this.plan.getTodaySummary(userId).catch(() => null),
    ]);

    return {
      examType: me.examType,
      moodLevel: today?.mood ?? null,
      struggleNote: today?.struggleNote ?? null,
      recentSessions,
      todayPlan,
    };
  }
}

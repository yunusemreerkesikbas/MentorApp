import { Inject, Injectable } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { CountdownDto, TodayPanelResponse } from "@mentor/types";
import { UsersService } from "../../identity/application/users.service";
import { SESSION_PRESETS } from "../domain/coaching.constants";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import { daysBetween, formatTurkishDate, todayIso } from "../domain/date.util";
import { MoodService } from "./mood.service";
import { PlanService } from "./plan.service";
import { StreakService } from "./streak.service";

/**
 * Composite "daily hub" payload for the Panel — assembled server-side so the client does ONE
 * round-trip and never recomputes business values (frontend standard / vercel-react-best-practices).
 *
 * Sources: greeting + exam type from identity (NOT a coaching query on `users`); countdown from
 * the content port (verified calendar, never `users.examDate`); streak from daily activity; mood
 * from today's check-in. Everything is ready to render.
 */
@Injectable()
export class TodayService {
  constructor(
    private readonly users: UsersService,
    private readonly plan: PlanService,
    private readonly streak: StreakService,
    private readonly mood: MoodService,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly i18n: I18nService,
  ) {}

  async getToday(userId: string): Promise<TodayPanelResponse> {
    const today = todayIso();
    // Identity owns the profile (display name + exam type) — read via its service, not a coaching query.
    const profile = await this.users.getMe(userId);

    const [countdown, streak, tasks, mood] = await Promise.all([
      this.buildCountdown(profile.examType, today),
      this.streak.getSummary(userId),
      this.plan.listForDate(userId, today),
      this.mood.getToday(userId),
    ]);

    return {
      greetingName: profile.displayName,
      motivationalLine: this.motivationalLine(streak.currentStreak),
      countdown,
      streak,
      tasks,
      sessionPresets: [...SESSION_PRESETS],
      mood,
    };
  }

  /** Build the calm countdown from the verified content calendar, or `null` (no silent fallback). */
  private async buildCountdown(
    examType: string | null,
    today: string,
  ): Promise<CountdownDto | null> {
    const calendar = await this.content.getExamCalendar(examType);
    if (!calendar) return null;
    return {
      examType: calendar.examType,
      examName: calendar.examName,
      daysRemaining: Math.max(0, daysBetween(today, calendar.examDate)),
      examDateLabel: formatTurkishDate(calendar.examDate),
      source: calendar.source,
      sourceUrl: calendar.sourceUrl,
    };
  }

  /** Rule-based, backend-localized motivational line (no AI on this surface — §4 #5). */
  private motivationalLine(currentStreak: number): string {
    const key = currentStreak > 0 ? "coaching.motivation.GOING" : "coaching.motivation.START";
    return this.i18n.translate(key, { lang: I18nContext.current()?.lang }) as unknown as string;
  }
}

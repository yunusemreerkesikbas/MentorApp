import { Inject, Injectable, Logger } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import type {
  CountdownDto,
  DailyNextActionDto,
  MoodCheckinDto,
  PlanTaskDto,
  TodayPanelResponse,
} from "@mentor/types";
import { UsersService } from "../../identity/application/users.service";
import { SESSION_PRESETS } from "../domain/coaching.constants";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import { daysBetween, formatTurkishDate, todayIso } from "../domain/date.util";
import { MoodService } from "./mood.service";
import { PlanService } from "./plan.service";
import { SessionService } from "./session.service";
import { StreakService } from "./streak.service";
import { WeeklyReviewService } from "./weekly-review.service";
import { weeklyReviewWindows } from "../domain/weekly-review";

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
  private readonly logger = new Logger(TodayService.name);

  constructor(
    private readonly users: UsersService,
    private readonly plan: PlanService,
    private readonly streak: StreakService,
    private readonly mood: MoodService,
    private readonly sessions: SessionService,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly i18n: I18nService,
    private readonly weeklyReview: WeeklyReviewService,
  ) {}

  async getToday(userId: string): Promise<TodayPanelResponse> {
    const today = todayIso();
    // Identity owns the profile (display name + exam type) — read via its service, not a coaching query.
    const profile = await this.users.getMe(userId);
    const recapWindow = profile.examType ? weeklyReviewWindows() : null;
    const calendarPromise = this.content.getExamCalendar(
      profile.examType,
      undefined,
      profile.examVariant,
    );
    const recapCalendarPromise =
      recapWindow == null
        ? Promise.resolve(null)
        : this.content.getExamCalendar(
            profile.examType,
            recapWindow.startDate,
            profile.examVariant,
          );
    const recapStatusPromise = recapCalendarPromise.then((calendar) =>
      calendar == null
        ? null
        : this.weeklyReview
            .getReview(userId, calendar.examId)
            .then((review) => review.recap.status),
    );

    const [
      calendar,
      recapCalendar,
      recapStatus,
      streak,
      tasks,
      mood,
      focusMinutesToday,
      focusingNow,
    ] = await Promise.all([
      calendarPromise,
      recapCalendarPromise,
      recapStatusPromise,
      this.streak.getSummary(userId),
      this.plan.listForDate(userId, today),
      this.mood.getToday(userId),
      this.sessions.getTodayFocusMinutes(userId),
      // Ambience only — a failed aggregate must never take the daily hub down (logged fallback).
      this.sessions.getFocusingNowCount().catch((err: unknown) => {
        this.logger.warn(`focusingNow unavailable: ${String(err)}`);
        return null;
      }),
    ]);
    const countdown = this.buildCountdown(calendar, today);

    return {
      greetingName: profile.displayName,
      motivationalLine: this.motivationalLine(streak.currentStreak),
      countdown,
      streak,
      tasks,
      nextAction: this.nextAction(tasks, mood),
      sessionPresets: [...SESSION_PRESETS],
      mood,
      focusGoal: {
        goalMinutes: profile.dailyFocusGoalMinutes,
        focusMinutesToday,
      },
      focusingNow,
      weeklyRecapPeriod:
        recapWindow == null || recapCalendar == null || recapStatus == null
          ? null
          : {
              examId: recapCalendar.examId,
              startDate: recapWindow.startDate,
              endDate: recapWindow.endDate,
              timeZone: "Europe/Istanbul",
              status: recapStatus,
            },
    };
  }

  private nextAction(
    tasks: PlanTaskDto[],
    mood: MoodCheckinDto | null,
  ): DailyNextActionDto {
    const pending = tasks.find((task) => task.status === "PENDING");
    const kind = pending
      ? "START_TASK"
      : tasks.length === 0
        ? "ADD_TASK"
        : "DAY_COMPLETE";
    const messageKey =
      kind === "START_TASK" && mood?.mood != null && mood.mood <= 2
        ? "coaching.nextAction.START_TASK.lowMoodMessage"
        : `coaching.nextAction.${kind}.message`;
    const lang = I18nContext.current()?.lang;

    return {
      kind,
      title: this.i18n.translate(`coaching.nextAction.${kind}.title`, {
        lang,
        args: { taskTitle: pending?.title },
      }) as unknown as string,
      message: this.i18n.translate(messageKey, {
        lang,
        args: { taskTitle: pending?.title },
      }) as unknown as string,
      taskId: pending?.id ?? null,
    };
  }

  /** Build the calm countdown from the verified content calendar, or `null` (no silent fallback). */
  private buildCountdown(
    calendar: Awaited<ReturnType<ContentPort["getExamCalendar"]>>,
    today: string,
  ): CountdownDto | null {
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
    const key =
      currentStreak > 0
        ? "coaching.motivation.GOING"
        : "coaching.motivation.START";
    return this.i18n.translate(key, {
      lang: I18nContext.current()?.lang,
    }) as unknown as string;
  }
}

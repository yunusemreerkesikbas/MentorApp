import { Injectable, Logger } from "@nestjs/common";
import { UsersService } from "../../identity/application/users.service";
import { MoodService } from "../../coaching/application/mood.service";
import { PlanService } from "../../coaching/application/plan.service";
import { SessionService } from "../../coaching/application/session.service";
import { ContentService } from "../../content/application/content.service";
import type { CoachContext } from "../domain/ai.constants";

/** Builds the PII-free coaching context without official dates or cross-thread memory. */
@Injectable()
export class ContextBuilder {
  private readonly logger = new Logger(ContextBuilder.name);

  constructor(
    private readonly users: UsersService,
    private readonly mood: MoodService,
    private readonly plan: PlanService,
    private readonly sessions: SessionService,
    private readonly content: ContentService,
  ) {}

  async build(userId: string): Promise<CoachContext> {
    const me = await this.users.getMe(userId);
    const [today, recentSessions, todayPlan, taxonomy] = await Promise.all([
      this.mood.getToday(userId).catch(() => {
        this.warnUnavailable("mood");
        return null;
      }),
      this.sessions.getRecentSummary(userId).catch(() => {
        this.warnUnavailable("session");
        return null;
      }),
      this.plan.getTodaySummary(userId).catch(() => {
        this.warnUnavailable("plan");
        return null;
      }),
      me.examType
        ? this.content
            .getExamCalendarByFamily(me.examType, undefined, me.examVariant)
            .then((calendar) =>
              calendar
                ? this.content.listExamSubjectsByExamId(calendar.exam.id)
                : [],
            )
            .catch(() => {
              this.warnUnavailable("taxonomy");
              return [];
            })
        : Promise.resolve([]),
    ]);
    const taxonomySubjects = new Map<string, string>();
    for (const subject of taxonomy) {
      taxonomySubjects.set(subject.slug.toLocaleLowerCase("tr-TR"), subject.name);
      taxonomySubjects.set(subject.name.toLocaleLowerCase("tr-TR"), subject.name);
    }
    const subjects = recentSessions
      ? [
          ...new Set(
            recentSessions.subjects.flatMap((subject) => {
              const match = taxonomySubjects.get(
                subject.trim().toLocaleLowerCase("tr-TR"),
              );
              return match ? [match] : [];
            }),
          ),
        ]
      : [];

    return {
      examType: me.examType,
      examVariant: me.examVariant,
      moodLevel: today?.mood ?? null,
      recentSessions: recentSessions
        ? {
            count7d: recentSessions.count7d,
            focusMinutes7d: recentSessions.focusMinutes7d,
            subjects,
          }
        : null,
      todayPlan: todayPlan
        ? { total: todayPlan.total, done: todayPlan.done }
        : null,
    };
  }

  private warnUnavailable(
    source: "mood" | "session" | "plan" | "taxonomy",
  ): void {
    this.logger.warn({ event: "coach_context_source_unavailable", source });
  }
}

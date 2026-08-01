import { Inject, Injectable, Logger } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import { CoachEvidenceType, type CoachUsedEvidenceDto } from "@mentor/types";
import { UsersService } from "../../identity/application/users.service";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import type { CoachEvidenceSnapshot } from "../domain/coach-evidence";
import { todayIso } from "../domain/date.util";
import { MockExamService } from "./mock-exam.service";
import { MoodService } from "./mood.service";
import { PlanService } from "./plan.service";
import { SessionService } from "./session.service";
import { StreakService } from "./streak.service";
import { VisionService } from "./vision.service";

/** Public W2 boundary that exposes aggregate, PII-minimal evidence to the AI module. */
@Injectable()
export class CoachEvidenceService {
  private readonly logger = new Logger(CoachEvidenceService.name);

  constructor(
    private readonly users: UsersService,
    private readonly plan: PlanService,
    private readonly sessions: SessionService,
    private readonly moods: MoodService,
    private readonly streak: StreakService,
    private readonly mockExams: MockExamService,
    private readonly vision: VisionService,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly i18n: I18nService,
  ) {}

  async build(
    userId: string,
    now = new Date(),
  ): Promise<CoachEvidenceSnapshot> {
    const me = await this.users.getMe(userId);
    const calendar = me.examType
      ? await this.safe("taxonomy-calendar", () =>
          this.content.getExamCalendar(me.examType),
        )
      : null;
    const taxonomy = calendar
      ? ((await this.safe("taxonomy", () =>
          this.content.listExamSubjects(calendar.examId),
        )) ?? [])
      : [];
    const [tasks, rhythm, mood, streak, mock, goal, actionOutcome] =
      await Promise.all([
        this.safe("plan", () => this.plan.listForDate(userId, todayIso())),
        this.safe("rhythm", () => this.sessions.getCoachRhythm(userId, now)),
        this.safe("mood", () => this.moods.getCoachMoodEvidence(userId)),
        this.safe("streak", () => this.streak.getCoachEvidence(userId)),
        this.safe("mock", () => this.loadMockEvidence(userId)),
        this.safe("goal", () => this.vision.getMine(userId)),
        this.safe("action-outcome", () =>
          this.plan.getAiCoachOutcomeSummary(userId),
        ),
      ]);

    const evidence: CoachUsedEvidenceDto[] = [];
    let planCompletionRate: number | null = null;
    if (tasks && tasks.length > 0) {
      const done = tasks.filter((task) => task.status === "DONE").length;
      planCompletionRate = Math.round((done / tasks.length) * 100);
      const taxonomyMap = new Map<string, string>();
      for (const subject of taxonomy) {
        taxonomyMap.set(subject.slug.toLocaleLowerCase("tr-TR"), subject.name);
        taxonomyMap.set(subject.name.toLocaleLowerCase("tr-TR"), subject.name);
      }
      const distribution = new Map<string, number>();
      for (const task of tasks) {
        const normalized = task.subject?.trim().toLocaleLowerCase("tr-TR");
        const subject = normalized ? taxonomyMap.get(normalized) : undefined;
        if (subject)
          distribution.set(subject, (distribution.get(subject) ?? 0) + 1);
      }
      const subjects = [...distribution]
        .map(([subject, count]) => `${subject}: ${count}`)
        .join(", ");
      evidence.push(
        this.item(
          CoachEvidenceType.TODAY_PLAN,
          subjects
            ? "coaching.coachEvidence.todayPlan"
            : "coaching.coachEvidence.todayPlanNoSubjects",
          now,
          {
            done,
            total: tasks.length,
            completionRate: planCompletionRate,
            subjects,
          },
        ),
      );
    }

    if (
      rhythm &&
      (rhythm.todayFocusMinutes > 0 || me.dailyFocusGoalMinutes !== null)
    ) {
      evidence.push(
        this.item(
          CoachEvidenceType.TODAY_FOCUS,
          me.dailyFocusGoalMinutes === null
            ? "coaching.coachEvidence.todayFocusNoGoal"
            : "coaching.coachEvidence.todayFocus",
          now,
          {
            minutes: rhythm.todayFocusMinutes,
            goal: me.dailyFocusGoalMinutes,
          },
        ),
      );
    }
    if (rhythm && rhythm.sessions7d > 0) {
      evidence.push(
        this.item(
          CoachEvidenceType.RECENT_RHYTHM,
          rhythm.dominantTimeBand
            ? "coaching.coachEvidence.recentRhythm"
            : "coaching.coachEvidence.recentRhythmNoTimeBand",
          rhythm.lastActiveAt ? new Date(rhythm.lastActiveAt) : now,
          {
            sessions: rhythm.sessions7d,
            minutes: rhythm.focusMinutes7d,
            activeDays: rhythm.activeDays7d,
            averageMinutes: rhythm.averageSessionMinutes7d,
            timeBand: rhythm.dominantTimeBand
              ? this.valueLabel("timeBand", rhythm.dominantTimeBand)
              : null,
          },
        ),
      );
    }
    if (rhythm && rhythm.sessions28d > 0) {
      evidence.push(
        this.item(
          CoachEvidenceType.LONG_TERM_RHYTHM,
          "coaching.coachEvidence.longTermRhythm",
          rhythm.lastActiveAt ? new Date(rhythm.lastActiveAt) : now,
          {
            sessions: rhythm.sessions28d,
            minutes: rhythm.focusMinutes28d,
            activeDays: rhythm.activeDays28d,
            averageMinutes: rhythm.averageSessionMinutes28d,
          },
        ),
      );
    }
    if (streak && (streak.currentStreak > 0 || streak.lastActiveDate)) {
      evidence.push(
        this.item(
          CoachEvidenceType.STREAK,
          "coaching.coachEvidence.streak",
          streak.lastActiveDate
            ? new Date(`${streak.lastActiveDate}T12:00:00Z`)
            : now,
          {
            current: streak.currentStreak,
            lastActiveDate: streak.lastActiveDate ?? "-",
          },
        ),
      );
    }
    if (mood?.today !== null && mood?.today !== undefined) {
      evidence.push(
        this.item(
          CoachEvidenceType.MOOD,
          "coaching.coachEvidence.mood",
          mood.observedAt,
          {
            level: mood.today,
            trend: this.valueLabel("trend", mood.trend),
          },
        ),
      );
    }
    if (mock && mock.count > 0) {
      evidence.push(
        this.item(
          CoachEvidenceType.MOCK_PERFORMANCE,
          mock.focusSubject
            ? "coaching.coachEvidence.mockPerformance"
            : "coaching.coachEvidence.mockPerformanceNoFocus",
          mock.observedAt,
          {
            count: mock.count,
            latestNet: mock.latestNet,
            trend: this.valueLabel("trend", mock.trend),
            focusSubject: mock.focusSubject,
          },
        ),
      );
    }
    // Raw goal title/motivation and opaque university id never enter the snapshot.
    if (goal?.careerGroup) {
      evidence.push(
        this.item(
          CoachEvidenceType.GOAL,
          "coaching.coachEvidence.goal",
          new Date(goal.updatedAt),
          {
            careerGroup: this.valueLabel("careerGroup", goal.careerGroup),
          },
        ),
      );
    }
    if (actionOutcome && actionOutcome.accepted > 0) {
      evidence.push(
        this.item(
          CoachEvidenceType.ACTION_OUTCOME,
          "coaching.coachEvidence.actionOutcome",
          actionOutcome.observedAt ?? now,
          {
            accepted: actionOutcome.accepted,
            completed: actionOutcome.completed,
            lastStatus: actionOutcome.lastStatus
              ? this.valueLabel("taskStatus", actionOutcome.lastStatus)
              : this.valueLabel("taskStatus", "UNKNOWN"),
          },
        ),
      );
    }

    return {
      examType: me.examType,
      dailyFocusGoalMinutes: me.dailyFocusGoalMinutes,
      moodLevel: mood?.today ?? null,
      moodTrend: mood?.trend ?? "UNKNOWN",
      planCompletionRate,
      pendingAiCoachPlanTaskId: actionOutcome?.pendingTaskId ?? null,
      evidence,
    };
  }

  private async loadMockEvidence(userId: string): Promise<{
    count: number;
    latestNet: string;
    trend: "UP" | "DOWN" | "STABLE" | "FIRST";
    focusSubject: string | null;
    observedAt: Date;
  } | null> {
    const [list, analysis] = await Promise.all([
      this.mockExams.list(userId, { page: 1, pageSize: 1 }),
      this.mockExams.getAnalysis(userId),
    ]);
    const latest = list.items[0];
    if (!latest) return null;
    const [latestTrend, previousTrend] = analysis.trend;
    let trend: "UP" | "DOWN" | "STABLE" | "FIRST" = "FIRST";
    if (latestTrend && previousTrend) {
      const delta =
        Number(latestTrend.totalNet) - Number(previousTrend.totalNet);
      trend = delta > 0 ? "UP" : delta < 0 ? "DOWN" : "STABLE";
    }
    return {
      count: list.total,
      latestNet: latest.totalNet,
      trend,
      focusSubject: analysis.nextFocus?.subjectName ?? null,
      observedAt: new Date(latest.takenAt),
    };
  }

  private item(
    type: CoachEvidenceType,
    key: string,
    observedAt: Date,
    args: Record<string, unknown>,
  ): CoachUsedEvidenceDto {
    return {
      type,
      summary: this.i18n.translate(key, {
        lang: I18nContext.current()?.lang,
        args,
      }) as unknown as string,
      observedAt: observedAt.toISOString(),
    };
  }

  private valueLabel(group: string, value: string): string {
    return this.i18n.translate(
      `coaching.coachEvidence.values.${group}.${value}`,
      { lang: I18nContext.current()?.lang },
    ) as unknown as string;
  }

  private async safe<T>(
    source: string,
    load: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await load();
    } catch (error) {
      this.logger.warn({
        event: "coach_evidence_source_unavailable",
        source,
        error: error instanceof Error ? error.name : "unknown",
      });
      return null;
    }
  }
}

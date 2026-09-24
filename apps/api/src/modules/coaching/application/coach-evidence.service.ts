import { Inject, Injectable, Logger } from "@nestjs/common";
import { I18nContext, I18nService } from "nestjs-i18n";
import {
  CoachEvidenceType,
  type CoachingAnalysisDto,
  type CoachUsedEvidenceDto,
} from "@mentor/types";
import { UsersService } from "../../identity/application/users.service";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import {
  examPhaseFor,
  weakestSubjects,
  type CoachEvidenceSnapshot,
} from "../domain/coach-evidence";
import { todayInIstanbul, todayIso } from "../domain/date.util";
import { MockExamService } from "./mock-exam.service";
import { AnalysisService } from "./analysis.service";
import { MentorshipWeeklyEvidenceService } from "./mentorship-weekly-evidence.service";
import { MoodService } from "./mood.service";
import { PlanService } from "./plan.service";
import { SessionService } from "./session.service";
import { StreakService } from "./streak.service";
import { VisionService } from "./vision.service";

/**
 * Public W2 boundary that exposes aggregate, PII-minimal evidence to the AI module: the one pool
 * every premium AI surface reads (roadmap "AI Koç Mimarisi").
 * ponytail: computed per call; add a short per-user cache if chat latency ever shows it.
 */
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
    private readonly analysis: AnalysisService,
    private readonly vision: VisionService,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
    private readonly i18n: I18nService,
    private readonly weekly: MentorshipWeeklyEvidenceService,
  ) {}

  async build(
    userId: string,
    now = new Date(),
  ): Promise<CoachEvidenceSnapshot> {
    const me = await this.users.getMe(userId);
    const calendar = me.examType
      ? await this.safe("taxonomy-calendar", () =>
          this.content.getExamCalendar(me.examType, undefined, me.examVariant),
        )
      : null;
    const taxonomy = calendar
      ? ((await this.safe("taxonomy", () =>
          this.content.listExamSubjects(calendar.examId),
        )) ?? [])
      : [];
    const [
      tasks,
      rhythm,
      mood,
      streak,
      performance,
      goal,
      actionOutcome,
      weekly,
    ] = await Promise.all([
      this.safe("plan", () => this.plan.listForDate(userId, todayIso())),
      this.safe("rhythm", () => this.sessions.getCoachRhythm(userId, now)),
      this.safe("mood", () => this.moods.getCoachMoodEvidence(userId)),
      this.safe("streak", () => this.streak.getCoachEvidence(userId)),
      this.safe("mock", () => this.loadMockEvidence(userId)),
      this.safe("goal", () => this.vision.getMine(userId)),
      this.safe("action-outcome", () =>
        this.plan.getAiCoachOutcomeSummary(userId),
      ),
      this.safe("weekly", () =>
        this.weekly.getSnapshot(userId, me.examType, undefined, now),
      ),
    ]);
    const mock = performance?.mock ?? null;
    const analysis = performance?.analysis ?? null;

    // Soft refs arrive as a slug or a display name; anything the taxonomy does not know is dropped.
    const taxonomyMap = new Map<string, string>();
    for (const subject of taxonomy) {
      taxonomyMap.set(subject.slug.toLocaleLowerCase("tr-TR"), subject.name);
      taxonomyMap.set(subject.name.toLocaleLowerCase("tr-TR"), subject.name);
    }
    const subjectName = (value: string | null | undefined) => {
      const normalized = value?.trim().toLocaleLowerCase("tr-TR");
      return normalized ? taxonomyMap.get(normalized) : undefined;
    };

    const evidence: CoachUsedEvidenceDto[] = [];
    let planCompletionRate: number | null = null;
    if (tasks && tasks.length > 0) {
      const done = tasks.filter((task) => task.status === "DONE").length;
      planCompletionRate = Math.round((done / tasks.length) * 100);
      const distribution = new Map<string, number>();
      for (const task of tasks) {
        const subject = subjectName(task.subject);
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
            lastActiveDate: streak.lastActiveDate
              ? this.day(streak.lastActiveDate)
              : "-",
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
    if (mock) {
      evidence.push(
        this.item(
          CoachEvidenceType.MOCK_PERFORMANCE,
          mock.focusSubject
            ? "coaching.coachEvidence.mockPerformance"
            : "coaching.coachEvidence.mockPerformanceNoFocus",
          mock.observedAt,
          {
            count: mock.count,
            latestNet: this.net(mock.latestNet),
            trend: this.valueLabel("trend", mock.trend),
            focusSubject: mock.focusSubject,
          },
        ),
      );
    }
    const weak = analysis ? weakestSubjects(analysis.subjects) : [];
    if (weak.length > 0) {
      evidence.push(
        this.item(
          CoachEvidenceType.WEAK_SUBJECTS,
          weak.length > 1
            ? "coaching.coachEvidence.weakSubjects"
            : "coaching.coachEvidence.weakSubject",
          mock?.observedAt ?? now,
          {
            // The net the ranking read: the recent window when there is one.
            subjects: weak
              .map(
                (subject) =>
                  `${subject.subjectName} (${this.net(subject.recentAverageNet ?? subject.averageNet)})`,
              )
              .join(", "),
          },
        ),
      );
    }
    if (analysis) {
      // A single card is a sighting, not a pattern: the analysis focus uses the same threshold.
      const repeated = analysis.photoTopicSignals
        .filter((signal) => signal.count >= 2)
        .sort(
          (a, b) =>
            b.count - a.count || a.topicName.localeCompare(b.topicName, "tr"),
        )
        .slice(0, 2);
      if (repeated.length > 0) {
        const due = analysis.notebookStats.dueCount;
        evidence.push(
          this.item(
            CoachEvidenceType.NOTEBOOK_TOPICS,
            due > 0
              ? "coaching.coachEvidence.notebookTopicsDue"
              : "coaching.coachEvidence.notebookTopics",
            now,
            {
              topics: repeated
                .map((signal) => `${signal.topicName} (${signal.count})`)
                .join(", "),
              ...(due > 0 ? { due } : {}),
            },
          ),
        );
      }
    }
    if (weekly) {
      const weekEnd = new Date(`${weekly.period.endDate}T12:00:00Z`);
      const minutes = new Map<string, number>();
      for (const row of weekly.subjects) {
        const name = subjectName(row.subjectRef);
        if (name && row.currentFocusMinutes > 0) {
          minutes.set(name, (minutes.get(name) ?? 0) + row.currentFocusMinutes);
        }
      }
      const top = [...minutes]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
        .slice(0, 2);
      if (top.length > 0) {
        const gap = weak
          .map((subject) => subject.subjectName)
          .find((name) => !minutes.has(name));
        evidence.push(
          this.item(
            CoachEvidenceType.SUBJECT_BALANCE,
            gap
              ? "coaching.coachEvidence.subjectBalanceGap"
              : "coaching.coachEvidence.subjectBalance",
            weekEnd,
            {
              subjects: top
                .map(([name, total]) => `${name} (${total})`)
                .join(", "),
              ...(gap ? { gap } : {}),
            },
          ),
        );
      }
      if (weekly.current.plannedTasks > 0) {
        evidence.push(
          this.item(
            CoachEvidenceType.PLAN_FOLLOW_THROUGH,
            "coaching.coachEvidence.planFollowThrough",
            weekEnd,
            {
              planned: weekly.current.plannedTasks,
              completed: weekly.current.completedTasks,
            },
          ),
        );
      }
    }
    const examPhase = calendar?.examDate
      ? examPhaseFor(calendar.examDate, todayInIstanbul(now))
      : null;
    if (examPhase) {
      evidence.push(
        this.item(
          CoachEvidenceType.EXAM_PHASE,
          `coaching.coachEvidence.examPhase.${examPhase}`,
          now,
          {},
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
      weakSubjects: weak.map((subject) => subject.subjectName),
      focusSubject: analysis?.nextFocus?.subjectName ?? null,
      examPhase,
      activeDays28d: rhythm?.activeDays28d ?? null,
      averageSessionMinutes28d: rhythm?.averageSessionMinutes28d ?? null,
      weekdayActivity28d: rhythm?.weekdayActivity28d ?? [],
      coverage: {
        mockCount: performance?.mockCount ?? 0,
        notebookCount: analysis?.notebookStats.savedCount ?? 0,
        sessions28d: rhythm?.sessions28d ?? 0,
      },
      evidence,
    };
  }

  /** One analysis read feeds mock performance, weak subjects and notebook topics alike. */
  private async loadMockEvidence(userId: string): Promise<{
    mock: {
      count: number;
      latestNet: string;
      trend: "UP" | "DOWN" | "STABLE" | "FIRST";
      focusSubject: string | null;
      observedAt: Date;
    } | null;
    mockCount: number;
    analysis: CoachingAnalysisDto;
  }> {
    const [list, analysis] = await Promise.all([
      this.mockExams.list(userId, { page: 1, pageSize: 1 }),
      this.analysis.getAnalysis(userId),
    ]);
    const latest = list.items[0];
    if (!latest) return { mock: null, mockCount: list.total, analysis };
    const [latestTrend, previousTrend] = analysis.trend;
    let trend: "UP" | "DOWN" | "STABLE" | "FIRST" = "FIRST";
    if (latestTrend && previousTrend) {
      const delta =
        Number(latestTrend.totalNet) - Number(previousTrend.totalNet);
      trend = delta > 0 ? "UP" : delta < 0 ? "DOWN" : "STABLE";
    }
    return {
      mock: {
        count: list.total,
        latestNet: latest.totalNet,
        trend,
        focusSubject: analysis.nextFocus?.subjectName ?? null,
        observedAt: new Date(latest.takenAt),
      },
      mockCount: list.total,
      analysis,
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

  /** Nets are stored as "61.25"; the reader sees "61,25" in Turkish. */
  private net(value: string): string {
    return Number(value).toLocaleString(this.locale(), {
      maximumFractionDigits: 2,
    });
  }

  /** yyyy-mm-dd → "1 Ağustos" / "August 1". */
  private day(date: string): string {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString(this.locale(), {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  }

  private locale(): "tr-TR" | "en-US" {
    return (I18nContext.current()?.lang ?? "tr").startsWith("en")
      ? "en-US"
      : "tr-TR";
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

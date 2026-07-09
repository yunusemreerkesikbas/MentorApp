import { Inject, Injectable } from "@nestjs/common";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { todayIso } from "../domain/date.util";
import { MoodCheckinRepository } from "../infrastructure/mood-checkin.repository";
import { PlanTaskRepository } from "../infrastructure/plan-task.repository";
import { StudySessionRepository } from "../infrastructure/study-session.repository";

export interface DailyQuestSignals {
  date: string;
  hasDonePlanTask: boolean;
  hasCompletedFocusSession: boolean;
  hasMoodCheckin: boolean;
  completedFocusSessions: number;
  completedPlanTasks: number;
}

@Injectable()
export class DailyQuestSignalService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly planTasks: PlanTaskRepository,
    private readonly sessions: StudySessionRepository,
    private readonly moods: MoodCheckinRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  async getToday(userId: string): Promise<DailyQuestSignals> {
    const date = todayIso();
    const minFocusSeconds = await this.config.get("coaching.session.min_focus_seconds");
    return withUserContext(this.db, { userId }, async (tx) => {
      const [doneTasks, hasCompletedFocusSession, mood, completedFocusSessions, completedPlanTasks] = await Promise.all([
        this.planTasks.countDone(tx, userId, date),
        this.sessions.hasCompletedOnDate(tx, userId, date, minFocusSeconds),
        this.moods.findByDate(tx, userId, date),
        this.sessions.countCompleted(tx, userId, minFocusSeconds),
        this.planTasks.countDoneAllTime(tx, userId),
      ]);
      return {
        date,
        hasDonePlanTask: doneTasks > 0,
        hasCompletedFocusSession,
        hasMoodCheckin: mood !== undefined,
        completedFocusSessions,
        completedPlanTasks,
      };
    });
  }
}

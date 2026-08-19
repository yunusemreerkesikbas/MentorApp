import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { AchievementId } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import {
  dailyActivity,
  mistakeNotebookEntries,
  mockExams,
  planTasks,
  studySessions,
  visionBoards,
} from "../../../database/schema";
import { hasSevenFullIstanbulDaysBetween } from "../domain/achievement-evidence";

export interface AchievementEvidence {
  userId: string;
  achievementId: AchievementId;
  earnedAt: Date;
}

@Injectable()
export class CoachingAchievementEvidenceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigRegistryService,
  ) {}

  async collect(userIds: string[]): Promise<AchievementEvidence[]> {
    if (userIds.length === 0) return [];
    const minFocus = await this.config.get("coaching.session.min_focus_seconds");
    return withServiceContext(this.db, async (tx) => {
      const [sessions, plans, boards, streakDays, exams, reviews] = await Promise.all([
        tx.select({ userId: studySessions.userId, startedAt: studySessions.startedAt })
          .from(studySessions)
          .where(and(inArray(studySessions.userId, userIds), eq(studySessions.status, "COMPLETED"), isNotNull(studySessions.endedAt), gte(studySessions.actualFocusSeconds, minFocus)))
          .orderBy(asc(studySessions.userId), asc(studySessions.startedAt)),
        tx.select({ userId: planTasks.userId, earnedAt: sql<Date>`min(${planTasks.createdAt})` })
          .from(planTasks).where(inArray(planTasks.userId, userIds)).groupBy(planTasks.userId),
        tx.select({ userId: visionBoards.userId, earnedAt: sql<Date>`min(${visionBoards.createdAt})` })
          .from(visionBoards)
          .where(and(
            inArray(visionBoards.userId, userIds),
            isNotNull(visionBoards.board),
            sql`length(trim(${visionBoards.goalTitle})) > 0`,
            sql`jsonb_typeof(${visionBoards.board}->'items') = 'array' and jsonb_array_length(${visionBoards.board}->'items') > 0`,
          ))
          .groupBy(visionBoards.userId),
        tx.select({ userId: dailyActivity.userId, date: dailyActivity.activityDate, earnedAt: dailyActivity.updatedAt })
          .from(dailyActivity)
          .where(and(inArray(dailyActivity.userId, userIds), eq(dailyActivity.hasSession, true)))
          .orderBy(asc(dailyActivity.userId), asc(dailyActivity.activityDate)),
        tx.select({ userId: mockExams.userId, earnedAt: sql<Date>`min(${mockExams.createdAt})` })
          .from(mockExams).where(inArray(mockExams.userId, userIds)).groupBy(mockExams.userId),
        tx.select({ userId: mistakeNotebookEntries.userId, earnedAt: sql<Date>`min(${mistakeNotebookEntries.lastReviewedAt})` })
          .from(mistakeNotebookEntries)
          .where(and(inArray(mistakeNotebookEntries.userId, userIds), isNotNull(mistakeNotebookEntries.lastReviewedAt)))
          .groupBy(mistakeNotebookEntries.userId),
      ]);

      const evidence: AchievementEvidence[] = [];
      for (const [rows, id] of [[plans, "route_drawn"], [boards, "dream_space_created"], [exams, "starting_point_set"], [reviews, "mistake_revisited"]] as const) {
        for (const row of rows) if (row.earnedAt) evidence.push({ userId: row.userId, achievementId: id, earnedAt: new Date(row.earnedAt) });
      }

      const sessionsByUser = groupByUser(sessions);
      for (const [userId, rows] of sessionsByUser) {
        const first = rows[0];
        if (first) evidence.push({ userId, achievementId: "first_step", earnedAt: first.startedAt });
        for (let index = 1; index < rows.length; index += 1) {
          if (hasSevenFullIstanbulDaysBetween(rows[index - 1]!.startedAt, rows[index]!.startedAt)) {
            evidence.push({ userId, achievementId: "returned_to_path", earnedAt: rows[index]!.startedAt });
            break;
          }
        }
      }

      const daysByUser = groupByUser(streakDays);
      for (const [userId, rows] of daysByUser) {
        let run = 0;
        let previous: number | null = null;
        for (const row of rows) {
          const day = Date.parse(`${row.date}T00:00:00Z`);
          run = previous !== null && day - previous === 86_400_000 ? run + 1 : 1;
          previous = day;
          if (run === 7) evidence.push({ userId, achievementId: "rhythm_found", earnedAt: row.earnedAt });
          if (run === 30) evidence.push({ userId, achievementId: "rhythm_kept", earnedAt: row.earnedAt });
        }
      }
      return evidence;
    });
  }
}

function groupByUser<T extends { userId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(row.userId, [...(grouped.get(row.userId) ?? []), row]);
  return grouped;
}

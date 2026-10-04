import {
  istanbulDate,
  weeklyReviewWindows,
} from "../src/modules/coaching/domain/weekly-review";

type DemoWeek = "current" | "previous";

export interface MentorshipWeeklyReportDemoSchedule {
  currentStartDate: string;
  previousStartDate: string;
  sessions: Array<{
    key: string;
    week: DemoWeek;
    startedAt: Date;
    endedAt: Date;
    focusMinutes: number;
    subjectIndex: number | null;
  }>;
  tasks: Array<{
    key: string;
    week: DemoWeek;
    taskDate: string;
    status: "PENDING" | "DONE";
    subjectIndex: number;
    sortOrder: number;
  }>;
  attempts: Array<{
    key: string;
    week: DemoWeek;
    takenAt: Date;
    publisher: string;
    scoreRatio: number;
  }>;
}

export function buildMentorshipWeeklyReportDemoSchedule(
  now = new Date(),
): MentorshipWeeklyReportDemoSchedule {
  const windows = weeklyReviewWindows(now);
  const currentStartDate = windows.startDate;
  const previousStartDate = istanbulDate(windows.previous.start);

  return {
    currentStartDate,
    previousStartDate,
    sessions: [
      session("previous-1", "previous", previousStartDate, 0, 45, 0),
      session("previous-2", "previous", previousStartDate, 2, 55, 1),
      session("previous-3", "previous", previousStartDate, 4, 35, 0),
      session("previous-4", "previous", previousStartDate, 5, 25, 2),
      session("current-1", "current", currentStartDate, 0, 55, 0),
      session("current-2", "current", currentStartDate, 1, 65, 1),
      session("current-3", "current", currentStartDate, 3, 45, 0),
      session("current-4", "current", currentStartDate, 4, 50, 2),
      session("current-unclassified", "current", currentStartDate, 5, 30, null),
    ],
    tasks: [
      task("previous-1", "previous", previousStartDate, 0, "DONE", 0, 0),
      task("previous-2", "previous", previousStartDate, 1, "DONE", 1, 1),
      task("previous-3", "previous", previousStartDate, 3, "DONE", 2, 2),
      task("previous-4", "previous", previousStartDate, 4, "PENDING", 0, 3),
      task("previous-5", "previous", previousStartDate, 5, "PENDING", 1, 4),
      task("current-1", "current", currentStartDate, 0, "DONE", 0, 0),
      task("current-2", "current", currentStartDate, 1, "DONE", 1, 1),
      task("current-3", "current", currentStartDate, 2, "DONE", 0, 2),
      task("current-4", "current", currentStartDate, 4, "DONE", 2, 3),
      task("current-5", "current", currentStartDate, 5, "PENDING", 1, 4),
      task("current-6", "current", currentStartDate, 6, "PENDING", 0, 5),
    ],
    attempts: [
      attempt("previous", "previous", previousStartDate, 5, "Pegem Akademi", 0.62),
      attempt("current", "current", currentStartDate, 5, "Yargı Yayınları", 0.7),
    ],
  };
}

function session(
  key: string,
  week: DemoWeek,
  startDate: string,
  dayOffset: number,
  focusMinutes: number,
  subjectIndex: number | null,
) {
  const startedAt = istanbulInstant(addIsoDays(startDate, dayOffset), 11);
  return {
    key,
    week,
    startedAt,
    endedAt: new Date(startedAt.getTime() + focusMinutes * 60_000),
    focusMinutes,
    subjectIndex,
  };
}

function task(
  key: string,
  week: DemoWeek,
  startDate: string,
  dayOffset: number,
  status: "PENDING" | "DONE",
  subjectIndex: number,
  sortOrder: number,
) {
  return {
    key,
    week,
    taskDate: addIsoDays(startDate, dayOffset),
    status,
    subjectIndex,
    sortOrder,
  };
}

function attempt(
  key: string,
  week: DemoWeek,
  startDate: string,
  dayOffset: number,
  publisher: string,
  scoreRatio: number,
) {
  return {
    key,
    week,
    takenAt: istanbulInstant(addIsoDays(startDate, dayOffset), 14),
    publisher,
    scoreRatio,
  };
}

function addIsoDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function istanbulInstant(date: string, localHour: number): Date {
  return new Date(`${date}T${String(localHour - 3).padStart(2, "0")}:00:00.000Z`);
}

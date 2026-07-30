import {
  istanbulDate,
  weeklyReviewWindows,
} from "../src/modules/coaching/domain/weekly-review";

export interface WeeklyRecapDemoSession {
  key: string;
  startedAt: Date;
  endedAt: Date;
  focusMinutes: number;
  subject: string;
}

export interface WeeklyRecapDemoTask {
  key: string;
  taskDate: string;
  title: string;
  subject: string;
  sortOrder: number;
}

export interface WeeklyRecapDemoSchedule {
  currentStartDate: string;
  previousStartDate: string;
  currentExamTakenAt: Date;
  previousExamTakenAt: Date;
  attemptDates: Date[];
  currentSessions: WeeklyRecapDemoSession[];
  previousSessions: WeeklyRecapDemoSession[];
  currentTasks: WeeklyRecapDemoTask[];
  previousTasks: WeeklyRecapDemoTask[];
}

export function buildWeeklyRecapDemoSchedule(
  now = new Date(),
): WeeklyRecapDemoSchedule {
  const windows = weeklyReviewWindows(now);
  const currentStartDate = windows.startDate;
  const previousStartDate = istanbulDate(windows.previous.start);
  const currentExamTakenAt = istanbulInstant(
    addIsoDays(currentStartDate, 5),
    11,
  );
  const previousExamTakenAt = istanbulInstant(
    addIsoDays(previousStartDate, 4),
    11,
  );

  return {
    currentStartDate,
    previousStartDate,
    currentExamTakenAt,
    previousExamTakenAt,
    attemptDates: Array.from({ length: 8 }, (_, index) => {
      if (index === 6) return previousExamTakenAt;
      if (index === 7) return currentExamTakenAt;
      const weeksBeforeCurrent = 7 - index;
      return new Date(
        currentExamTakenAt.getTime() -
          weeksBeforeCurrent * 7 * 24 * 60 * 60 * 1000,
      );
    }),
    currentSessions: [
      demoSession("current-1", currentStartDate, 0, 50, "Matematik"),
      demoSession("current-2", currentStartDate, 1, 80, "Matematik"),
      demoSession("current-3", currentStartDate, 2, 45, "Tarih"),
      demoSession("current-4", currentStartDate, 3, 60, "Matematik"),
      demoSession("current-5", currentStartDate, 5, 30, "Coğrafya"),
    ],
    previousSessions: [
      demoSession("previous-1", previousStartDate, 0, 70, "Matematik"),
      demoSession("previous-2", previousStartDate, 2, 70, "Tarih"),
      demoSession("previous-3", previousStartDate, 4, 70, "Matematik"),
      demoSession("previous-4", previousStartDate, 4, 25, "Türkçe", 15),
    ],
    currentTasks: [
      demoTask("current-1", currentStartDate, 0, "Matematik tekrarını tamamla", "Matematik", 0),
      demoTask("current-2", currentStartDate, 1, "Problem pratiğini bitir", "Matematik", 1),
      demoTask("current-3", currentStartDate, 2, "Tarih notlarını gözden geçir", "Tarih", 2),
      demoTask("current-4", currentStartDate, 3, "Harita tekrarını tamamla", "Coğrafya", 3),
    ],
    previousTasks: [
      demoTask("previous-1", previousStartDate, 0, "Matematik tekrarını tamamla", "Matematik", 0),
      demoTask("previous-2", previousStartDate, 2, "Tarih notlarını gözden geçir", "Tarih", 1),
    ],
  };
}

function demoSession(
  key: string,
  startDate: string,
  dayOffset: number,
  focusMinutes: number,
  subject: string,
  localHour = 11,
): WeeklyRecapDemoSession {
  const date = addIsoDays(startDate, dayOffset);
  const startedAt = istanbulInstant(date, localHour);
  return {
    key,
    startedAt,
    endedAt: new Date(startedAt.getTime() + focusMinutes * 60 * 1000),
    focusMinutes,
    subject,
  };
}

function demoTask(
  key: string,
  startDate: string,
  dayOffset: number,
  title: string,
  subject: string,
  sortOrder: number,
): WeeklyRecapDemoTask {
  return {
    key,
    taskDate: addIsoDays(startDate, dayOffset),
    title,
    subject,
    sortOrder,
  };
}

function addIsoDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function istanbulInstant(date: string, localHour: number): Date {
  const utcHour = String(localHour - 3).padStart(2, "0");
  return new Date(`${date}T${utcHour}:00:00.000Z`);
}

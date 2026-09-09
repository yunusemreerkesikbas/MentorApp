const ISTANBUL_UTC_OFFSET = "+03:00";
const REMINDER_LEAD_MS = 15 * 60 * 1_000;

export function planEventStartAt(eventDate: string, startTime: string): Date {
  const wallClock = startTime.length === 5 ? `${startTime}:00` : startTime;
  const instant = new Date(`${eventDate}T${wallClock}${ISTANBUL_UTC_OFFSET}`);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Invalid plan event wall-clock value");
  }
  return instant;
}

export function planEventReminderSchedule(
  occurrence: { eventDate: string; startTime: string | null },
  now: Date,
): { expectedStartAt: string; runAt: Date } | null {
  if (!occurrence.startTime) return null;

  const startAt = planEventStartAt(
    occurrence.eventDate,
    occurrence.startTime,
  );
  if (startAt.getTime() <= now.getTime()) return null;

  const reminderAt = new Date(startAt.getTime() - REMINDER_LEAD_MS);
  return {
    expectedStartAt: startAt.toISOString(),
    runAt: reminderAt.getTime() < now.getTime() ? now : reminderAt,
  };
}

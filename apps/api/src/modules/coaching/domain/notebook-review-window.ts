/** Istanbul has a fixed UTC+03 offset; include today and the preceding calendar days. */
export function notebookReviewWindow(days: 7 | 30, now: Date): Date {
  const local = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - days + 1,
    ) -
      3 * 60 * 60 * 1000,
  );
}

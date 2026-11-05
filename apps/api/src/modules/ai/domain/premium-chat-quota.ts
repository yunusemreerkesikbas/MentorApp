const DAY_MS = 24 * 60 * 60 * 1000;
export const CHAT_MONTH_MS = 30 * DAY_MS;

export interface ChatQuotaLimits {
  daily: number;
  monthly: number;
}

export function chatQuotaStatus(
  newestFirst: readonly Date[],
  limits: ChatQuotaLimits,
  now: Date,
) {
  const dailyUsed = newestFirst.filter((date) => date.getTime() > now.getTime() - DAY_MS).length;
  const dailyRemaining = Math.max(0, limits.daily - dailyUsed);
  const monthlyRemaining = Math.max(0, limits.monthly - newestFirst.length);
  const dailyCutoff = newestFirst[limits.daily - 1];
  const monthlyCutoff = newestFirst[limits.monthly - 1];
  const dailyRetry = dailyRemaining === 0 && dailyCutoff
    ? dailyCutoff.getTime() + DAY_MS
    : 0;
  const monthlyRetry = monthlyRemaining === 0 && monthlyCutoff
    ? monthlyCutoff.getTime() + CHAT_MONTH_MS
    : 0;

  return {
    dailyRemaining,
    monthlyRemaining,
    retryAt: limits.daily > 0 && (dailyRetry || monthlyRetry)
      ? new Date(Math.max(dailyRetry, monthlyRetry)).toISOString()
      : null,
  };
}

"use client";

import { useFormatter, useTranslations } from "next-intl";

const REMAINING_HINT_THRESHOLD = 5;

export function CoachQuotaHint({
  remaining,
  retryAt,
  premium,
}: {
  remaining: number | null;
  retryAt?: string | null;
  premium: boolean;
}) {
  const t = useTranslations("coach.chat");
  const format = useFormatter();
  if (remaining === null || remaining > REMAINING_HINT_THRESHOLD) return null;

  let message = t("remaining_hint", { count: remaining });
  if (remaining === 0) {
    message = retryAt
      ? t("premium_quota_retry", {
          time: format.dateTime(new Date(retryAt), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Europe/Istanbul",
          }),
        })
      : t(premium ? "premium_quota_full" : "remaining_hint_zero");
  }

  return (
    <p className="px-5 pb-1 text-center text-xs text-[var(--color-secondary)]" role="status">
      {message}
    </p>
  );
}

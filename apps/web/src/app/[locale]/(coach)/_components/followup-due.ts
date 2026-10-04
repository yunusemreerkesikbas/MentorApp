"use client";

import { useFormatter, useTranslations } from "next-intl";
import { todayInIstanbul } from "@/lib/date-time";

/**
 * When a follow-up wants its check, on the Istanbul calendar: "Kontrol bugün", "Kontrol günü
 * geçti", "Kontrol 30 Eylül". The roster's inbox and the student page's card say it the same way.
 */
export function useFollowupDue(): (date: string | null) => string {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const today = todayInIstanbul();
  return (date) =>
    date === null
      ? t("followup_no_date")
      : date === today
        ? t("followup_check_today")
        : date < today
          ? t("followup_check_overdue")
          : t("followup_check_on", {
              // A calendar day: formatting it in UTC keeps it on the right day.
              date: format.dateTime(new Date(`${date}T00:00:00.000Z`), {
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }),
            });
}

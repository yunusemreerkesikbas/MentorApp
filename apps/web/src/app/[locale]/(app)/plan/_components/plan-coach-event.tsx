"use client";

import { CalendarClock, Clock } from "lucide-react";
import type { PlanEventDto } from "@mentor/types";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { planEventNeutralColor } from "@/lib/plan-event-colors";
import { DetailRow } from "./plan-event-details";
import { formatDateLabel, formatTimeRange } from "./plan-utils";

/** "Koçunla" on a meeting somebody else (the coach) set up; nothing on the student's own. */
function useWithWhom(event: PlanEventDto): string | null {
  const t = useTranslations("plan");
  const { user } = useAuth();
  return event.organizerUserId === user?.id ? null : t("event_with_coach");
}

/**
 * A meeting on the day's list. It only opens its details: a meeting is attended, not ticked off,
 * and the coach who set it up is the one who moves or cancels it.
 */
export function PlanCoachEventRow({ event, onOpen }: { event: PlanEventDto; onOpen: () => void }) {
  const t = useTranslations("plan");
  const withWhom = useWithWhom(event);
  const cancelled = event.status === "CANCELLED";
  const line = [
    formatTimeRange(event.startTime, event.endTime) ?? t("all_day"),
    withWhom,
    cancelled ? t("event_cancelled") : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-[var(--radius-card)] py-3 text-left focus-visible:outline-none focus-visible:ring-2"
    >
      <CalendarClock
        size={20}
        strokeWidth={2}
        aria-hidden
        className="mt-0.5 shrink-0"
        style={{ color: "var(--color-secondary)" }}
      />
      <span className="flex min-w-0 flex-col">
        <span
          className={`text-base ${cancelled ? "line-through opacity-70" : ""}`}
          style={{ color: "var(--color-main)" }}
        >
          {event.title}
        </span>
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {line.join(" · ")}
        </span>
      </span>
    </button>
  );
}

/**
 * The meeting's details sheet. Read-only, for the same reason as the row. Sheets render outside the
 * auth provider, so the caller says who the meeting is with.
 */
export function PlanCoachEventDetails({
  event,
  withWhom,
}: {
  event: PlanEventDto;
  withWhom: string | null;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const cancelled = event.status === "CANCELLED";
  const range = formatTimeRange(event.startTime, event.endTime);
  const when = `${formatDateLabel(event.eventDate, locale, t("today"), { alwaysFull: true })}, ${range ?? t("all_day")}`;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col gap-2 rounded-[var(--radius-card)] p-4"
        style={{ backgroundColor: planEventNeutralColor.bg }}
      >
        <p
          className={`text-lg font-bold leading-snug ${cancelled ? "line-through opacity-70" : ""}`}
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {event.title}
        </p>
        <p className="flex items-center gap-2 text-sm" style={{ color: "var(--color-body)" }}>
          <Clock size={16} strokeWidth={2} aria-hidden />
          {when}
        </p>
        {withWhom ? (
          <p className="text-sm" style={{ color: "var(--color-body)" }}>
            {withWhom}
          </p>
        ) : null}
      </div>

      {cancelled || event.description ? (
        <dl className="flex flex-col">
          {cancelled ? <DetailRow label={t("event_status")} value={t("event_cancelled")} /> : null}
          {event.description ? (
            <DetailRow label={t("description")} value={event.description} multiline />
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

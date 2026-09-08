"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ExamCalendarDto } from "@mentor/types";
import { Card, CountdownCard } from "@mentor/ui";
import { fetchExamCalendarByFamily } from "@/lib/content-api";

/**
 * How long the coach's students have left (APP-090).
 *
 * The same card the student panel shows, on purpose: a coach plans against the same date, and
 * APP-089 already reframed `users.examType` for them as "the exam you coach". What differs is where
 * the number comes from — the panel reads `data.countdown` off `GET /v1/coaching/today`, and a coach
 * calling that would be pulling a whole student plan payload to read one date out of it.
 *
 * `fetchExamCalendarByFamily` is the existing public seam onto the same verified calendar, so this
 * needed no endpoint of its own. The date stays authoritative content (guardrail §4 #1): the days
 * are computed server-side, never here.
 */
export function CoachCountdownCard({ examType }: { examType: string | null }) {
  const t = useTranslations("countdown");
  const [calendar, setCalendar] = useState<ExamCalendarDto | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // No fetch to wait on, and no `setLoaded` here: `loaded` tracks the request, and the render
    // below answers the no-exam case before it ever reads the flag.
    if (!examType) return;
    let active = true;
    fetchExamCalendarByFamily(examType)
      .then((next) => {
        if (!active) return;
        setCalendar(next);
        setLoaded(true);
      })
      .catch(() => {
        // The roster is the screen. A missing countdown is a quiet gap, not an error worth a toast.
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [examType]);

  if (!examType) return <CountdownNote text={t("no_exam_type")} />;
  // Nothing until the first read answers, so the rail does not flash "no calendar" and then fill in.
  if (!loaded) return null;
  // `daysRemaining` is null when the calendar carries no upcoming EXAM_DATE. No silent fallback to
  // a guessed date — the copy says the calendar is not published yet, because that is the truth.
  if (calendar?.daysRemaining == null) return <CountdownNote text={t("no_calendar")} />;

  return (
    <CountdownCard
      daysRemaining={calendar.daysRemaining}
      examName={calendar.exam.name}
      examDateLabel={calendar.examDateLabel ?? undefined}
      labels={{ remaining: t("title"), dayUnit: t("day_unit"), today: t("today") }}
    />
  );
}

function CountdownNote({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
        {text}
      </p>
    </Card>
  );
}

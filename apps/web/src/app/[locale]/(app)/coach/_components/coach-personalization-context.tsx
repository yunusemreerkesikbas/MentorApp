"use client";

import { useTranslations } from "next-intl";
import BadgeCheck from "lucide-react/dist/esm/icons/badge-check.mjs";
import BookOpen from "lucide-react/dist/esm/icons/book-open.mjs";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import ClipboardCheck from "lucide-react/dist/esm/icons/clipboard-check.mjs";
import Clock3 from "lucide-react/dist/esm/icons/clock-3.mjs";
import Smile from "lucide-react/dist/esm/icons/smile.mjs";
import type { CoachPersonalizationDto } from "@mentor/types";

export function CoachPersonalizationContext({
  personalization,
}: {
  personalization: CoachPersonalizationDto;
}) {
  const t = useTranslations("coach_chat.personalization");
  const usedSignals = new Set(personalization.usedSignals ?? []);
  const usedEvidence = personalization.usedEvidence ?? [];

  if (usedSignals.size === 0 && usedEvidence.length === 0) return null;

  return (
    <details className="group w-full max-w-2xl text-sm text-[var(--color-secondary-text)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-card)] px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] [&::-webkit-details-marker]:hidden">
        <BadgeCheck
          className="size-4 shrink-0 text-[var(--color-accent)]"
          aria-hidden
        />
        <span className="font-semibold text-[var(--color-body-text)]">
          {t("used_context_label")}
        </span>
        <span className="ml-auto">{t("why")}</span>
        <ChevronDown
          className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>

      <div className="mt-1 grid gap-2 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] p-3">
        {usedEvidence.map((evidence) => (
          <ContextLine key={`${evidence.type}:${evidence.observedAt}`} icon={BadgeCheck}>
            {evidence.summary}
          </ContextLine>
        ))}
        {personalization.todayPlan && usedSignals.has("TODAY_PLAN") ? (
          <ContextLine icon={ClipboardCheck}>
            {t("today_plan", personalization.todayPlan)}
          </ContextLine>
        ) : null}
        {personalization.recentSessions && usedSignals.has("RECENT_SESSIONS") ? (
          <>
            <ContextLine icon={Clock3}>
              {t("recent_sessions", {
                count7d: personalization.recentSessions.count7d,
                focusMinutes7d:
                  personalization.recentSessions.focusMinutes7d,
              })}
            </ContextLine>
            {personalization.recentSessions.subjects.length > 0 ? (
              <ContextLine icon={BookOpen}>
                {t("subjects", {
                  subjects: personalization.recentSessions.subjects.join(", "),
                })}
              </ContextLine>
            ) : null}
          </>
        ) : null}
        {personalization.moodLevel !== null && usedSignals.has("MOOD") ? (
          <ContextLine icon={Smile}>
            {t("mood", { level: personalization.moodLevel })}
          </ContextLine>
        ) : null}
      </div>
    </details>
  );
}

function ContextLine({
  icon: Icon,
  children,
}: {
  icon: typeof Clock3;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

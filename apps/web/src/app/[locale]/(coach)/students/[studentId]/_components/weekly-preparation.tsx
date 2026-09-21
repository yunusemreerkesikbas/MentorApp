"use client";

import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipMeetingPreparationDto,
  MentorshipWeeklyEvidenceDto,
} from "@mentor/types";
import {
  INSET_GROUP_CLASS,
  NOTE_CLASS,
} from "@/components/mentorship/coach-ui";
import { formatWeeklyMetric } from "@/lib/mentorship-weekly-report";

export function PreparationEvidence({
  ids,
  evidence,
}: {
  ids: string[];
  evidence: MentorshipWeeklyEvidenceDto[];
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  return (
    <ul className="flex flex-col gap-1">
      {ids.map((id) => {
        const item = evidence.find((row) => row.id === id);
        if (!item) return null;
        const label = item.subjectRef
          ? `${item.subjectRef} · ${t(item.kind === "FOCUS_MINUTES" ? "weekly_report_evidence_focus_minutes" : "weekly_report_evidence_mock_average")}`
          : t(`weekly_report_evidence_${id}`);
        return (
          <li key={id} className={NOTE_CLASS}>
            {label}: {formatWeeklyMetric(item.kind, item.previous, locale)} →{" "}
            {formatWeeklyMetric(item.kind, item.current, locale)}
            {item.currentAttemptCount !== undefined && (
              <span>
                {" "}
                ·{" "}
                {t("preparation_attempts", {
                  previous: item.previousAttemptCount ?? 0,
                  current: item.currentAttemptCount,
                })}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function WeeklyPreparation({
  preparation,
  evidence,
}: {
  preparation: MentorshipMeetingPreparationDto;
  evidence: MentorshipWeeklyEvidenceDto[];
}) {
  const t = useTranslations("mentorship");
  return (
    <div className={`${INSET_GROUP_CLASS} flex flex-col gap-5 p-4`}>
      <section className="flex flex-col gap-2">
        <h4 className="coach-headline">{t("preparation_focus")}</h4>
        <p className="coach-body whitespace-pre-wrap break-words">
          {preparation.focus.text}
        </p>
        <PreparationEvidence
          ids={preparation.focus.evidenceIds}
          evidence={evidence}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h4 className="coach-headline">{t("preparation_progress")}</h4>
        <p className="coach-body whitespace-pre-wrap break-words">
          {preparation.progress?.text ?? t("preparation_no_progress")}
        </p>
        {preparation.progress && (
          <PreparationEvidence
            ids={preparation.progress.evidenceIds}
            evidence={evidence}
          />
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h4 className="coach-headline">{t("preparation_question")}</h4>
        <p className={NOTE_CLASS}>{preparation.uncertainty}</p>
        <p className="coach-body whitespace-pre-wrap break-words">
          {preparation.question}
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h4 className="coach-headline">{t("preparation_next_step")}</h4>
        <p className="coach-body whitespace-pre-wrap break-words">
          {preparation.nextStep ?? t("preparation_no_next_step")}
        </p>
      </section>
    </div>
  );
}

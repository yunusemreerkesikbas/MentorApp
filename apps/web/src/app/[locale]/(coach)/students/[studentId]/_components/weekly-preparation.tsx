"use client";

import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipMeetingPreparationDto,
  MentorshipWeeklyEvidenceDto,
  MentorshipWeeklySubjectNamesDto,
} from "@mentor/types";
import {
  INSET_GROUP_CLASS,
  NOTE_CLASS,
} from "@/components/mentorship/coach-ui";
import { formatWeeklyMetric } from "@/lib/mentorship-weekly-report";

const HEADING = "text-base font-extrabold text-[var(--color-main)]";
const BODY = "text-body-sm whitespace-pre-wrap break-words text-[var(--color-body)]";

export function PreparationEvidence({
  ids,
  evidence,
  subjectNames,
}: {
  ids: string[];
  evidence: MentorshipWeeklyEvidenceDto[];
  subjectNames: MentorshipWeeklySubjectNamesDto;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  return (
    <ul className="flex flex-col gap-1">
      {ids.map((id) => {
        const item = evidence.find((row) => row.id === id);
        if (!item) return null;
        const label = item.subjectRef
          ? `${subjectNames[item.subjectRef] ?? item.subjectRef} · ${t(item.kind === "FOCUS_MINUTES" ? "weekly_report_evidence_focus_minutes" : "weekly_report_evidence_mock_average")}`
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
  subjectNames,
}: {
  preparation: MentorshipMeetingPreparationDto;
  evidence: MentorshipWeeklyEvidenceDto[];
  subjectNames: MentorshipWeeklySubjectNamesDto;
}) {
  const t = useTranslations("mentorship");
  return (
    <div className={`${INSET_GROUP_CLASS} flex flex-col gap-5 p-4`}>
      <section className="flex flex-col gap-2">
        <h4 className={HEADING}>{t("preparation_focus")}</h4>
        <p className={BODY}>{preparation.focus.text}</p>
        <PreparationEvidence
          ids={preparation.focus.evidenceIds}
          evidence={evidence}
          subjectNames={subjectNames}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h4 className={HEADING}>{t("preparation_progress")}</h4>
        <p className={BODY}>{preparation.progress?.text ?? t("preparation_no_progress")}</p>
        {preparation.progress && (
          <PreparationEvidence
            ids={preparation.progress.evidenceIds}
            evidence={evidence}
            subjectNames={subjectNames}
          />
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h4 className={HEADING}>{t("preparation_question")}</h4>
        <p className={NOTE_CLASS}>{preparation.uncertainty}</p>
        <p className={BODY}>{preparation.question}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h4 className={HEADING}>{t("preparation_next_step")}</h4>
        <p className={BODY}>{preparation.nextStep ?? t("preparation_no_next_step")}</p>
      </section>
    </div>
  );
}

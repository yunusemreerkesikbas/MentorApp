"use client";

import { useTranslations } from "next-intl";
import type { WeeklyDeepAnalysisDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";

export function WeeklyDeepAnalysisSubjects({ subjects }: { subjects: WeeklyDeepAnalysisDto["subjects"] }) {
  const t = useTranslations("analysis.report");
  return <section className={PANEL_CARD} aria-labelledby="deep-subjects-title">
    <h2 id="deep-subjects-title" className={PANEL_CARD_TITLE}>{t("subjects")}</h2>
    {subjects.length ? <ul className="mt-4 divide-y divide-[var(--color-border)]">
      {subjects.map((subject) => <li key={subject.subjectRef} className="py-4 first:pt-0 last:pb-0">
        <h3 className="font-extrabold text-[var(--color-main)]">{subject.subjectName}</h3>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div><dt className="text-[var(--color-secondary)]">{t("current_week")}</dt>
            <dd className="mt-1 font-extrabold text-[var(--color-main)]">{subject.averageNet === null ? t("no_attempt") : t("net", { net: subject.averageNet })}</dd></div>
          <div><dt className="text-[var(--color-secondary)]">{t("previous_week")}</dt>
            <dd className="mt-1 font-extrabold text-[var(--color-main)]">{subject.previousAverageNet === null ? t("no_attempt") : t("net", { net: subject.previousAverageNet })}</dd></div>
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-secondary)]">{subject.message}</p>
        <p className="mt-2 text-sm font-bold text-[var(--color-main)]">
          {t("subject_activity", { minutes: subject.focusMinutes, tasks: subject.completedTaskCount })}
        </p>
      </li>)}
    </ul> : <p className="mt-3 text-sm text-[var(--color-secondary)]">{t("subjects_empty")}</p>}
  </section>;
}

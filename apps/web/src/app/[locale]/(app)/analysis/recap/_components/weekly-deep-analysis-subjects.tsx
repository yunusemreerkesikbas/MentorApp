"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { WeeklyDeepAnalysisDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { parseNet } from "@/lib/weekly-deep-analysis";
import { DeltaChip, MUTED_CHIP, signed } from "./weekly-deep-analysis-parts";

/** The backend line only where it adds something: comfort on a drop, the next move without an exam. */
const NOTE_TRENDS = new Set(["DOWN", "NO_EXAM", "EARLY"]);

export function WeeklyDeepAnalysisSubjects({ subjects }: { subjects: WeeklyDeepAnalysisDto["subjects"] }) {
  const t = useTranslations("analysis.report");
  const format = useFormatter();
  const net = (value: number) => t("net", { net: format.number(value, { maximumFractionDigits: 2 }) });
  return <section className={PANEL_CARD} aria-labelledby="deep-subjects-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="deep-subjects-title" className={PANEL_CARD_TITLE}>{t("subjects")}</h2>
      {subjects.length ? <span className="text-caption text-[var(--color-secondary)]">{t("subjects_hint")}</span> : null}
    </div>
    {subjects.length ? <ul className="mt-2 divide-y divide-[var(--color-border)]">
      {subjects.map((subject) => {
        const current = parseNet(subject.averageNet);
        const previous = parseNet(subject.previousAverageNet);
        const delta = parseNet(subject.delta);
        const meta = [
          current === null ? null : t("subject_current", { count: subject.mockExamCount }),
          previous !== null ? t("subject_previous", { net: net(previous), count: subject.previousMockExamCount })
            : current !== null ? t("subject_previous_missing") : null,
          subject.focusMinutes ? t("subject_focus", { minutes: subject.focusMinutes }) : null,
          subject.completedTaskCount ? t("subject_tasks", { count: subject.completedTaskCount }) : null,
        ].filter(Boolean).join(" · ");
        return <li key={subject.subjectRef} className="flex flex-col gap-1.5 py-3.5 last:pb-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="flex-1 font-extrabold text-[var(--color-main)]">{subject.subjectName}</h3>
            {current === null ? <span className={MUTED_CHIP}>{t("no_attempt")}</span> : <>
              {delta ? <DeltaChip delta={delta}>{signed(delta, format.number(Math.abs(delta), { maximumFractionDigits: 2 }))}</DeltaChip> : null}
              <span className="min-w-16 whitespace-nowrap text-right text-xl font-black tabular-nums text-[var(--color-main)]">{net(current)}</span>
            </>}
          </div>
          {meta ? <p className="text-caption tabular-nums text-[var(--color-secondary)]">{meta}</p> : null}
          {NOTE_TRENDS.has(subject.trend) ? <p className="text-caption leading-relaxed text-[var(--color-body)]">{subject.message}</p> : null}
        </li>;
      })}
    </ul> : <p className="mt-3 text-sm text-[var(--color-secondary)]">{t("subjects_empty")}</p>}
  </section>;
}

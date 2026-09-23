"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto, PhotoTopicSignalDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";
import { Link } from "@/i18n/navigation";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * "Nerede kaçırıyorsun?": subject and topic signals in one card, topics under their subject. A row
 * opens that subject's or topic's review, which is how a student picks a topic to work on now that
 * the "Başka konu seç" menu is gone. A topic alone in its subject shows its count, not "%100".
 */
export function MistakesWhereCard({
  analysis,
  examId,
}: {
  analysis: CoachingAnalysisDto;
  examId: string;
}) {
  const t = useTranslations("analysis.mistakes");
  const tAnalysis = useTranslations("analysis");
  const subjects = analysis.photoSubjectSignals;
  if (subjects.length === 0) return null;

  const topicsBySubject = new Map<string, PhotoTopicSignalDto[]>();
  for (const topic of analysis.photoTopicSignals) {
    topicsBySubject.set(topic.subjectRef, [...(topicsBySubject.get(topic.subjectRef) ?? []), topic]);
  }

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-labelledby="analysis-where-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 id="analysis-where-title" className={PANEL_CARD_TITLE}>
          {t("where_title")}
        </h2>
        <span className="text-caption font-bold text-[var(--color-secondary)]">
          {t("where_caption")}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {subjects.map((subject) => {
          const topics = topicsBySubject.get(subject.subjectRef) ?? [];
          return (
            <li key={subject.subjectRef}>
              <Link
                href={{
                  pathname: "/notebook",
                  query: { review: "focus", examId, subjectRef: subject.subjectRef },
                }}
                className={`flex min-h-11 flex-col justify-center gap-2 py-1 ${FOCUS_RING}`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-extrabold text-[var(--color-main)]">
                    {subject.subjectName}
                  </span>
                  <span className="shrink-0 text-caption font-extrabold tabular-nums text-[var(--color-secondary)]">
                    {subjects.length === 1
                      ? t("topic_count", { count: subject.count })
                      : tAnalysis("signal_share", {
                          count: subject.count,
                          percent: subject.sharePercent,
                        })}
                  </span>
                </span>
                <span aria-hidden className="block">
                  <ProgressLine
                    label={subject.subjectName}
                    value={subject.sharePercent}
                    max={100}
                  />
                </span>
              </Link>
              {topics.length > 0 ? (
                <ul className="flex flex-col">
                  {topics.map((topic) => (
                    <li key={topic.topicRef}>
                      <Link
                        href={{
                          pathname: "/notebook",
                          query: {
                            review: "focus",
                            examId,
                            subjectRef: topic.subjectRef,
                            topicRef: topic.topicRef,
                          },
                        }}
                        className={`flex min-h-11 items-center gap-2 pl-5 ${FOCUS_RING}`}
                      >
                        <span className="min-w-0 flex-1 py-1 text-sm font-bold leading-snug text-[var(--color-body)]">
                          {topic.topicName}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-caption font-bold tabular-nums text-[var(--color-secondary)]">
                          {t("topic_count", { count: topic.count })}
                        </span>
                        <ChevronRight
                          className="size-4 shrink-0 text-[var(--color-secondary)]"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

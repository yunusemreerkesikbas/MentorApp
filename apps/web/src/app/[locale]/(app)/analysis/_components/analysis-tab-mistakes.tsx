"use client";

import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto } from "@mentor/types";
import { Card, ProgressBar, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/empty-state";

interface AnalysisTabMistakesProps {
  analysis: CoachingAnalysisDto | null;
  examId: string;
}

export function AnalysisTabMistakes({ analysis, examId }: AnalysisTabMistakesProps) {
  const t = useTranslations("analysis");
  const notebookT = useTranslations("notebook");
  const signals = analysis?.photoSubjectSignals ?? [];
  const topicSignals = analysis?.photoTopicSignals ?? [];
  const topicGroups = topicSignals.reduce<
    Array<{
      subjectRef: string;
      subjectName: string;
      topics: typeof topicSignals;
    }>
  >((groups, signal) => {
    const group = groups.find((item) => item.subjectRef === signal.subjectRef);
    if (group) group.topics.push(signal);
    else
      groups.push({
        subjectRef: signal.subjectRef,
        subjectName: signal.subjectName,
        topics: [signal],
      });
    return groups;
  }, []);
  const errorSignals = analysis?.notebookErrorSignals ?? [];

  return (
    <div className="flex flex-col gap-6">
      {analysis ? (
        <Card>
          <SectionHeading subtitle={t("notebook_stats_subtitle", { days: analysis.notebookStats.windowDays })}>
            {t("notebook_stats_title")}
          </SectionHeading>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["savedCount", "reviewedCount", "dueCount", "healedCount"] as const).map((key) => (
              <div key={key} className="rounded-[var(--radius-card)] border p-3" style={{ borderColor: "var(--color-border)" }}>
                <dt className="text-xs" style={{ color: "var(--color-secondary)" }}>
                  {t(`notebook_stats.${key}`)}
                </dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums" style={{ color: "var(--color-main)" }}>
                  {analysis.notebookStats[key]}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}
      {/*
        The notebook replaced the photo-categorize card here. That card told the student the
        subject of a mistake they had just made — something they already knew — and burned a
        premium quota doing it. What they cannot work out alone is the shape below: not *where*
        the points went, but *why*.
      */}
      {errorSignals.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <SectionHeading as="h2" subtitle={t("error_signals_subtitle")}>
            {t("error_signals_title")}
          </SectionHeading>
          {analysis?.notebookErrorMessage ? (
            <p className="text-sm" style={{ color: "var(--color-body)" }}>
              {analysis.notebookErrorMessage}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {errorSignals.map((signal) => (
              <li key={signal.errorType} className="flex flex-col gap-1">
                <Link
                  href={{ pathname: "/notebook", query: { panel: "index", examId, errorType: signal.errorType } }}
                  className="rounded-[var(--radius-card)] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm" style={{ color: "var(--color-main)" }}>
                    {notebookT(`error_type.${signal.errorType}`)}
                  </span>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("signal_share", { count: signal.count, percent: signal.sharePercent })}
                  </span>
                </div>
                <ProgressBar
                  value={signal.sharePercent}
                />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/notebook"
            className="flex min-h-11 items-center justify-center rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ backgroundColor: "var(--color-btn)" }}
          >
            {t("notebook_open")}
          </Link>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title={t("notebook_empty_title")}
            description={t("notebook_empty_desc")}
            puhuVariant="default"
            action={
              <Link
                href="/notebook"
                className="flex min-h-11 items-center justify-center rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-[var(--color-btn-label)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ backgroundColor: "var(--color-btn)" }}
              >
                {t("notebook_open")}
              </Link>
            }
          />
        </Card>
      )}

      {topicSignals.length > 0 ? (
        <Card>
          <SectionHeading subtitle={t("photo_topic_signals_subtitle")}>
            {t("photo_topic_signals_title")}
          </SectionHeading>
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("photo_topic_signals_window")}
          </p>
          <div className="mt-4 flex flex-col gap-5">
            {topicGroups.map((group) => (
              <section
                key={group.subjectRef}
                aria-labelledby={"topic-group-" + group.subjectRef}
              >
                <h3
                  id={"topic-group-" + group.subjectRef}
                  className="mb-2 text-sm font-bold"
                  style={{ color: "var(--color-main)" }}
                >
                  {group.subjectName}
                </h3>
                <ul className="flex flex-col gap-3">
                  {group.topics.map((signal) => (
                    <li key={signal.topicRef} className="flex flex-col gap-1">
                      <Link
                        href={{ pathname: "/notebook", query: { panel: "index", examId, subjectRef: signal.subjectRef, topicRef: signal.topicRef } }}
                        className="rounded-[var(--radius-card)] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                      >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span style={{ color: "var(--color-body)" }}>
                          {signal.topicName}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          {t("signal_share", { count: signal.count, percent: signal.sharePercent })}
                        </span>
                      </div>
                      <ProgressBar
                        value={signal.sharePercent}
                      />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      ) : null}
      {signals.length > 0 ? (
        <Card>
          <SectionHeading subtitle={t("photo_signals_subtitle")}>
            {t("photo_signals_title")}
          </SectionHeading>
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("photo_signals_window")}
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {signals.map((signal) => (
              <li key={signal.subjectRef} className="flex flex-col gap-1">
                <Link
                  href={{ pathname: "/notebook", query: { panel: "index", examId, subjectRef: signal.subjectRef } }}
                  className="rounded-[var(--radius-card)] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span style={{ color: "var(--color-body)" }}>
                    {signal.subjectName}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("signal_share", { count: signal.count, percent: signal.sharePercent })}
                  </span>
                </div>
                <ProgressBar
                  value={signal.sharePercent}
                />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title={t("photo_signals_title")}
            description={t("photo_signals_empty_desc")}
            puhuVariant="default"
          />
        </Card>
      )}
    </div>
  );
}

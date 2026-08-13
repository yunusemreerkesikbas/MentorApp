"use client";

import { useTranslations } from "next-intl";
import type { CoachingAnalysisDto, PhotoAccessDto } from "@mentor/types";
import {
  Button,
  Card,
  ProgressBar,
  SectionHeading,
  Skeleton,
  SkeletonGroup,
} from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form";
import { PhotoCategorizeCard } from "./photo-categorize-card";

type PhotoAccessState =
  | { status: "idle"; examId: string | null }
  | { status: "loading"; examId: string }
  | { status: "ready"; examId: string; data: PhotoAccessDto }
  | { status: "error"; examId: string; message: string };

interface AnalysisTabMistakesProps {
  activeMockExamId: string | null;
  photoAccessState: PhotoAccessState;
  analysis: CoachingAnalysisDto | null;
  onCategorized: () => void;
  onRetryAccess: () => void;
}

export function AnalysisTabMistakes({
  activeMockExamId,
  photoAccessState,
  analysis,
  onCategorized,
  onRetryAccess,
}: AnalysisTabMistakesProps) {
  const t = useTranslations("analysis");
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
  const maxTopicCount = topicSignals.reduce(
    (maximum, signal) => Math.max(maximum, signal.count),
    0,
  );
  const maxCount = signals.reduce(
    (maximum, signal) => Math.max(maximum, signal.count),
    0,
  );
  const photoAccess =
    photoAccessState.status === "ready" ? photoAccessState.data : null;

  return (
    <div className="flex flex-col gap-6">
      {!activeMockExamId ? (
        <Card>
          <EmptyState
            title={t("photo_section_title")}
            description={t("photo_no_exam_desc")}
            puhuVariant="default"
            action={
              <Link
                href={{ pathname: "/analysis", query: { tab: "entry" } }}
                className="flex min-h-11 items-center justify-center rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ backgroundColor: "var(--color-btn)" }}
              >
                {t("photo_enter_exam")}
              </Link>
            }
          />
        </Card>
      ) : photoAccessState.status === "error" ? (
        <Card className="flex flex-col items-start gap-3">
          <SectionHeading as="h2" subtitle={t("photo_unavailable")}>
            {t("photo_section_title")}
          </SectionHeading>
          <FormError message={photoAccessState.message} />
          <Button type="button" variant="secondary" onClick={onRetryAccess}>
            {t("photo_retry")}
          </Button>
        </Card>
      ) : photoAccess ? (
        <PhotoCategorizeCard
          mockExamId={activeMockExamId}
          access={photoAccess}
          onCategorized={onCategorized}
        />
      ) : (
        <SkeletonGroup label={t("photo_loading")} className="block">
          <Card className="flex flex-col gap-4">
            <Skeleton className="h-6 w-48 rounded-[var(--radius-card)]" />
            <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
            <Skeleton className="h-11 w-full rounded-[var(--radius-card)]" />
          </Card>
        </SkeletonGroup>
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
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span style={{ color: "var(--color-body)" }}>
                          {signal.topicName}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          {t("photo_count", { count: signal.count })}
                        </span>
                      </div>
                      <ProgressBar
                        value={
                          maxTopicCount > 0
                            ? Math.round((signal.count / maxTopicCount) * 100)
                            : 0
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      ) : signals.length > 0 ? (
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
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span style={{ color: "var(--color-body)" }}>
                    {signal.subjectName}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("photo_count", { count: signal.count })}
                  </span>
                </div>
                <ProgressBar
                  value={
                    maxCount > 0
                      ? Math.round((signal.count / maxCount) * 100)
                      : 0
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title={t("photo_signals_title")}
            description={
              activeMockExamId && photoAccess?.canCategorize
                ? t("photo_signals_empty_action")
                : t("photo_signals_empty_desc")
            }
            puhuVariant="default"
          />
        </Card>
      )}
    </div>
  );
}

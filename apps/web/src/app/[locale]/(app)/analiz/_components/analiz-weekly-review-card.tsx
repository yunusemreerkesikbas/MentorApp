"use client";

import { useTranslations } from "next-intl";
import type { WeeklyReviewDto } from "@mentor/types";
import {
  Card,
  Chip,
  SectionHeading,
  Skeleton,
  SkeletonGroup,
} from "@mentor/ui";
import { Link } from "@/i18n/navigation";

interface AnalizWeeklyReviewCardProps {
  review: WeeklyReviewDto;
}

export function AnalizWeeklyReviewCard({
  review,
}: AnalizWeeklyReviewCardProps) {
  const t = useTranslations("analysis.weekly");

  return (
    <Card
      className="flex flex-col gap-5"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--color-chip) 14%, white), white 70%)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading subtitle={t("period", review.period)}>
          {t("title")}
        </SectionHeading>
        <Chip>
          {review.status === "READY" ? t("ready") : t("insufficient")}
        </Chip>
      </div>

      {review.status === "INSUFFICIENT" ? (
        <div className="flex flex-col gap-4">
          <p
            className="text-sm leading-6"
            style={{ color: "var(--color-body)" }}
          >
            {review.rhythm.message}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/analiz?tab=gir"
              className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-card)] px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{ background: "var(--color-btn)", color: "white" }}
            >
              {t("enter_exam")}
            </Link>
            <Link
              href="/seans"
              className="flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-card)] px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                background: "var(--color-surface-container)",
                color: "var(--color-main)",
              }}
            >
              {t("start_session")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <ReviewSection
            title={t("rhythm_title")}
            value={t("rhythm_value", {
              sessions: review.rhythm.completedSessionCount,
              minutes: review.rhythm.focusMinutes,
              days: review.rhythm.activeDays,
            })}
            message={review.rhythm.message}
          />
          <ReviewSection
            title={t("performance_title")}
            value={
              review.performance
                ? t("net_value", { net: review.performance.averageNet })
                : t("no_exam")
            }
            message={review.performance?.message ?? t("no_exam_message")}
          />
          <ReviewSection
            title={t("focus_title")}
            value={review.focus?.subjectName ?? t("rhythm_focus")}
            message={review.focus?.message ?? t("rhythm_focus_message")}
          />
        </div>
      )}
    </Card>
  );
}

export function AnalizWeeklyReviewSkeleton() {
  const t = useTranslations("analysis.weekly");

  return (
    <SkeletonGroup label={t("loading")} className="block">
      <Card className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-36 rounded-[var(--radius-card)]" />
            <Skeleton className="h-4 w-44 rounded-[var(--radius-card)]" />
          </div>
          <Skeleton className="h-7 w-28 rounded-[var(--radius-card)]" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] p-4"
              style={{ background: "var(--color-surface-container)" }}
            >
              <Skeleton className="h-4 w-24 rounded-[var(--radius-card)]" />
              <Skeleton className="h-6 w-32 rounded-[var(--radius-card)]" />
              <Skeleton className="h-4 w-full rounded-[var(--radius-card)]" />
            </div>
          ))}
        </div>
      </Card>
    </SkeletonGroup>
  );
}

function ReviewSection({
  title,
  value,
  message,
}: {
  title: string;
  value: string;
  message: string;
}) {
  return (
    <section
      className="flex flex-col gap-2 rounded-[var(--radius-card)] p-4"
      style={{ background: "var(--color-surface-container)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: "var(--color-main)" }}>
        {title}
      </h3>
      <p
        className="text-lg font-bold tabular-nums"
        style={{ color: "var(--color-main)" }}
      >
        {value}
      </p>
      <p
        className="text-sm leading-5"
        style={{ color: "var(--color-secondary)" }}
      >
        {message}
      </p>
    </section>
  );
}

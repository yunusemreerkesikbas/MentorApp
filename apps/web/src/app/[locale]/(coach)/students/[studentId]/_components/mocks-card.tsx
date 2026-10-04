"use client";

import dynamic from "next/dynamic";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { Skeleton } from "@mentor/ui";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { firstName } from "@/lib/greeting";
import { drawOrder } from "@/components/mentorship/coach-motion";
import { formatNet } from "../../../_components/mentorship-format";

// Nivo is the heaviest thing on the page, and the chart sits below the fold everywhere.
const StatLineChart = dynamic(
  () => import("@/components/stat-line-chart").then((mod) => mod.StatLineChart),
  { ssr: false, loading: () => <Skeleton className="h-48 rounded-[var(--radius-card)]" /> },
);

/** Below ±0.05 net an arrow would be noise. */
const STEADY = 0.05;

/**
 * "Denemeler", in the student's own `/analiz` language: the latest net with its move against the
 * attempt before (a drop is grey, never red), the line with each exam named, and the latest
 * attempt's subjects as correct / wrong / blank parts of one bar.
 */
export function MocksCard({ report }: { report: MentorshipStudentReportDto }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const format = useFormatter();
  const mocks = report.mockTrend;
  const latest = mocks[0];
  const net = (value: number) => formatNet(value, locale) ?? "";

  if (!latest) {
    return (
      <section className={`${PANEL_CARD} coach-reveal flex flex-col gap-3`} aria-labelledby="mocks-title">
        <h2 id="mocks-title" className={PANEL_CARD_TITLE}>
          {t("report_mocks")}
        </h2>
        <p className="text-body-sm font-semibold text-[var(--color-body)]">
          {t("mocks_empty", { name: firstName(report.studentDisplayName) })}
        </p>
      </section>
    );
  }

  const previous = mocks[1];
  const delta = previous ? latest.totalNet - previous.totalNet : 0;
  const record = Math.max(...mocks.map((mock) => mock.totalNet));
  // Oldest first for the line; the index keeps two exams on one day two points.
  const series = mocks.map((mock, index) => ({ mock, id: `${index}` })).reverse();
  const byId = new Map(series.map((point) => [point.id, point.mock]));
  const shortDate = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short" });
  const longDate = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "long" });

  return (
    <section className={`${PANEL_CARD} coach-reveal flex flex-col gap-4`} aria-labelledby="mocks-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="mocks-title" className={PANEL_CARD_TITLE}>
          {t("report_mocks")}
        </h2>
        <span className="text-caption font-bold text-[var(--color-secondary)]">
          {t("mocks_window", { count: mocks.length })}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-display font-black leading-none tabular-nums text-[var(--color-main)]">
            {net(latest.totalNet)}
          </span>
          <span className="text-body-sm font-extrabold text-[var(--color-secondary)]">{t("mocks_unit")}</span>
          {previous && Math.abs(delta) >= STEADY ? (
            <>
              <span
                className={`inline-flex items-center gap-0.5 text-body-sm font-extrabold tabular-nums ${delta > 0 ? "text-[var(--color-success)]" : "text-[var(--color-secondary)]"}`}
              >
                {delta > 0 ? (
                  <ArrowUpRight className="size-4" strokeWidth={2.6} aria-hidden />
                ) : (
                  <ArrowDownRight className="size-4" strokeWidth={2.6} aria-hidden />
                )}
                <span className="sr-only">{delta > 0 ? t("mocks_up") : t("mocks_down")}</span>
                {net(Math.abs(delta))}
              </span>
              <span className="text-caption font-semibold text-[var(--color-secondary)]">
                {t("mocks_delta_caption")}
              </span>
            </>
          ) : null}
        </div>
        {mocks.length > 1 ? (
          <span className="text-caption font-bold text-[var(--color-secondary)]">
            {t.rich("mocks_record", {
              value: net(record),
              b: (chunks) => (
                <strong className="font-extrabold tabular-nums text-[var(--color-main)]">{chunks}</strong>
              ),
            })}
          </span>
        ) : null}
      </div>

      {series.length > 1 ? (
        <StatLineChart
          data={[
            {
              id: t("report_mocks"),
              data: series.map((point) => ({ x: point.id, y: point.mock.totalNet })),
            },
          ]}
          ariaLabel={t("report_mocks_trend_label", { count: series.length })}
          height={184}
          valueSuffix={` ${t("mocks_unit")}`}
          formatX={(id) => shortDate(byId.get(id)!.takenAt)}
          describeX={(id) => {
            const mock = byId.get(id)!;
            return [longDate(mock.takenAt), mock.publisherName, mock.examName].filter(Boolean).join(" · ");
          }}
          marker={{ value: record, label: t("mocks_record_marker") }}
          tableCaption={t("mocks_table_caption")}
        />
      ) : (
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("mocks_first")}</p>
      )}

      {report.latestMockSubjects.length > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h3 className="text-caption font-extrabold text-[var(--color-secondary)]">
              {t("mocks_subjects_title", { date: longDate(latest.takenAt) })}
            </h3>
            <p
              aria-hidden
              className="flex items-center gap-3.5 text-caption font-bold text-[var(--color-secondary)]"
            >
              <Swatch className="bg-[var(--chart-correct)]" label={t("mocks_correct")} />
              <Swatch className="bg-[var(--chart-wrong)]" label={t("mocks_wrong")} />
              <Swatch className="bg-[var(--play-track)]" label={t("mocks_blank")} />
            </p>
          </div>
          <ul className="flex flex-col">
            {report.latestMockSubjects.map((subject, index) => (
              <li
                key={subject.subjectRef}
                className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3.5rem] items-center gap-3 py-1.5 sm:grid-cols-[9rem_minmax(0,1fr)_4rem] sm:gap-3.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-extrabold text-[var(--color-main)]">
                    {subject.subjectName}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-[var(--color-secondary)]">
                    {t("mocks_subject_counts", {
                      correct: subject.correct,
                      wrong: subject.wrong,
                      blank: subject.blank,
                    })}
                  </span>
                </span>
                <span
                  role="img"
                  aria-label={t("mocks_subject_aria", {
                    subject: subject.subjectName,
                    correct: subject.correct,
                    wrong: subject.wrong,
                    blank: subject.blank,
                    net: net(subject.net),
                  })}
                  // Each subject's bar grows from its start once; the first four step, the rest go together.
                  className="coach-draw-grow-x flex h-2.5 gap-0.5"
                  style={drawOrder(Math.min(index, 3))}
                >
                  <Part grow={subject.correct} className="bg-[var(--chart-correct)]" />
                  <Part grow={subject.wrong} className="bg-[var(--chart-wrong)]" />
                  <Part grow={subject.blank} className="bg-[var(--play-track)]" />
                </span>
                <span className="text-right text-body-sm font-black tabular-nums text-[var(--color-main)]">
                  {net(subject.net)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Part({ grow, className }: { grow: number; className: string }) {
  return grow > 0 ? <span className={`rounded-full ${className}`} style={{ flexGrow: grow }} /> : null;
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

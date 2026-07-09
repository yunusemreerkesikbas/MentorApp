"use client";

import type { ReactNode } from "react";
import type { PlanTaskDto } from "@mentor/types";
import { Card, Chip } from "@mentor/ui";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.mjs";
import EllipsisVertical from "lucide-react/dist/esm/icons/ellipsis-vertical.mjs";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PlanTimelineSkeleton } from "./plan-content-skeleton";
import {
  formatMonthDayShort,
  PLAN_TIMELINE_SCROLL_AFTER_TASKS,
} from "./plan-utils";

export function PlanTimelineView({
  date,
  tasks,
  loading,
  busyId,
  readOnly,
  onMenu,
}: {
  date: string;
  tasks: PlanTaskDto[];
  loading: boolean;
  busyId: string | null;
  readOnly?: boolean;
  onMenu: (task: PlanTaskDto) => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const visible = loading ? [] : tasks;
  const pending = visible.filter((task) => task.status !== "DONE");
  const done = visible.filter((task) => task.status === "DONE");
  const { day, month } = formatMonthDayShort(date, locale);
  const scrollable = visible.length > PLAN_TIMELINE_SCROLL_AFTER_TASKS;

  if (loading) {
    return <PlanTimelineSkeleton />;
  }

  return (
    <Card className="relative overflow-hidden">
      <div
        className={`relative flex items-stretch ${scrollable ? "" : "min-h-[280px]"}`}
      >
        <div className="relative flex w-12 shrink-0 flex-col items-center self-stretch">
          <div
            className="absolute bottom-0 top-0 w-0.5 -translate-x-1/2"
            style={{
              left: "50%",
              backgroundColor: "var(--color-progress-track)",
            }}
            aria-hidden
          />
          <div
            className="sticky top-0 z-10 mt-1 flex h-11 w-11 flex-col items-center justify-center rounded-full border-2 border-white text-center shadow-[var(--shadow-card)]"
            style={{ backgroundColor: "var(--color-progress)" }}
          >
            <span
              className="text-[11px] font-bold leading-none text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {day}
              <br />
              {month}
            </span>
          </div>
        </div>

        <div
          className={`min-w-0 flex-1 pl-3 ${scrollable ? "mentor-plan-timeline-scroll" : ""}`}
          tabIndex={scrollable ? 0 : undefined}
          aria-label={scrollable ? t("timeline_scroll_aria") : undefined}
        >
          <TimelineSection
            title={t("pending_section", { count: pending.length })}
            dotColor="var(--color-progress)"
          >
            {pending.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
                {t("pending_empty")}
              </p>
            ) : (
              pending.map((task) => (
                <TimelineTaskCard
                  key={task.id}
                  task={task}
                  pending
                  busy={busyId === task.id}
                  readOnly={readOnly}
                  onMenu={() => onMenu(task)}
                />
              ))
            )}
          </TimelineSection>

          <TimelineSection
            title={t("done_section", { count: done.length })}
            dotColor="#22C55E"
            className="mt-8"
          >
            {done.map((task) => (
              <TimelineTaskCard
                key={task.id}
                task={task}
                busy={busyId === task.id}
                readOnly={readOnly}
                onMenu={() => onMenu(task)}
              />
            ))}
          </TimelineSection>
        </div>
      </div>

      {scrollable ? (
        <div
          className="pointer-events-none absolute bottom-0 left-12 right-0 h-10"
          style={{
            background:
              "linear-gradient(to top, color-mix(in srgb, var(--color-surface) 94%, transparent), transparent)",
          }}
          aria-hidden
        />
      ) : null}
    </Card>
  );
}

function TimelineSection({
  title,
  dotColor,
  className,
  children,
}: {
  title: string;
  dotColor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <h3
        className="mb-3 flex items-center gap-2 text-sm font-bold"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function TimelineTaskCard({
  task,
  pending,
  busy,
  readOnly,
  onMenu,
}: {
  task: PlanTaskDto;
  pending?: boolean;
  busy?: boolean;
  readOnly?: boolean;
  onMenu: () => void;
}) {
  const t = useTranslations("plan");
  const isDone = task.status === "DONE";

  return (
    <article
      className="relative rounded-[var(--radius-card)] border border-white/40 p-3 shadow-[var(--shadow-card)]"
      style={{
        backgroundColor: isDone
          ? "color-mix(in srgb, var(--color-surface-container) 80%, transparent)"
          : "rgba(255,255,255,0.85)",
        opacity: isDone ? 0.92 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {isDone ? (
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0"
                style={{ color: "#22C55E" }}
                aria-hidden
              />
            ) : null}
            <h4
              className={`text-base font-bold ${isDone ? "line-through" : ""}`}
              style={{
                color: isDone ? "var(--color-secondary)" : "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {task.title}
            </h4>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.subject ? (
              <Chip className="px-2 py-0.5 text-[10px] font-bold uppercase">
                {task.subject}
              </Chip>
            ) : null}
            {pending && !readOnly ? (
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--color-secondary)" }}
              >
                {t("today")} ·{" "}
                <Link
                  href={
                    task.subject
                      ? { pathname: "/seans", query: { subject: task.subject } }
                      : "/seans"
                  }
                  className="inline-flex items-center gap-0.5 font-bold"
                  style={{ color: "var(--color-progress)" }}
                >
                  {t("start_session")}
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </span>
            ) : null}
          </div>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={onMenu}
            disabled={busy}
            className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-colors hover:bg-white/60 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-secondary)" }}
            aria-label={t("task_menu_aria", { title: task.title })}
          >
            <EllipsisVertical size={20} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  );
}

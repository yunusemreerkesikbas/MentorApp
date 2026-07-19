"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import { useTranslations } from "next-intl";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import { ApiClientError, planTaskControllerUpdate } from "@mentor/api-client";
import { Card, PlanListItem, ProgressBar, SectionHeading } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { buildStudySessionHrefFromPlanTask } from "@/lib/plan-study-session-link";
import { useMentorToast } from "@/lib/mentor-toast";
import { staggerItemVariants } from "@/lib/stagger-motion";

export type TodayPlanTasksChangedOptions = {
  celebrateDone?: boolean;
};

/**
 * Today's plan — client container for the panel's task list.
 *
 * Owns ephemeral UI state (optimistic done-toggle). Each toggle calls
 * `PATCH /v1/plan-tasks/:id`; full CRUD lives on `/plan`.
 */
export function TodayPlan({
  tasks: initialTasks,
  onTasksChanged,
}: {
  tasks: PlanTaskDto[];
  onTasksChanged?: (opts?: TodayPlanTasksChangedOptions) => void;
}) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("today_plan");
  const tPlan = useTranslations("plan");
  const tCommon = useTranslations("common");
  const { error: showErrorToast } = useMentorToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);

  const doneCount = useMemo(
    () => tasks.filter((t) => t.status === "DONE").length,
    [tasks],
  );
  const completion =
    tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);

  async function toggle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task || busyId) return;

    const nextStatus: PlanTaskStatus =
      task.status === "DONE" ? "PENDING" : "DONE";
    const previous = tasks;

    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)),
    );
    setBusyId(id);

    try {
      const updated = (await planTaskControllerUpdate(id, {
        status: nextStatus,
      })) as unknown as PlanTaskDto;
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      onTasksChanged?.(
        nextStatus === "DONE" ? { celebrateDone: true } : undefined,
      );
    } catch (err) {
      setTasks(previous);
      showErrorToast({
        title: tCommon("error_title"),
        message:
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : tCommon("error_unknown"),
        duration: 3000,
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <SectionHeading
        subtitle={
          tasks.length > 0
            ? t("progress", { done: doneCount, total: tasks.length })
            : undefined
        }
        action={<AddTaskLink />}
      >
        {t("title")}
      </SectionHeading>

      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <motion.div
            className="mt-4"
            key={completion}
            initial={reduceMotion ? false : { opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <ProgressBar value={completion} />
          </motion.div>
          <motion.ul
            className="mt-3 flex flex-col gap-1"
            initial={reduceMotion ? false : "hidden"}
            animate={reduceMotion ? undefined : "show"}
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.06 } },
            }}
          >
            {tasks.map((task) => (
              <motion.li
                key={task.id}
                variants={reduceMotion ? undefined : staggerItemVariants}
                className="flex flex-col gap-1"
              >
                <PlanListItem
                  title={task.title}
                  subject={task.subject}
                  done={task.status === "DONE"}
                  onToggle={() => void toggle(task.id)}
                />
                {task.status !== "DONE" ? (
                  <Link
                    href={buildStudySessionHrefFromPlanTask(task)}
                    className="ml-14 text-xs font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
                    style={{ color: "var(--color-progress)" }}
                  >
                    {tPlan("start_session")} →
                  </Link>
                ) : null}
              </motion.li>
            ))}
          </motion.ul>
        </>
      )}
    </Card>
  );
}

function AddTaskLink() {
  const t = useTranslations("today_plan");
  return (
    <Link
      href="/plan"
      className="flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-card)] px-3 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
    >
      <Plus size={18} strokeWidth={2} aria-hidden />
      {t("add_task")}
    </Link>
  );
}

function EmptyState() {
  const t = useTranslations("today_plan");
  return (
    <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-card)]"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-chip) 22%, transparent)",
          color: "var(--color-chip-text)",
        }}
      >
        <Plus size={18} strokeWidth={2} aria-hidden />
      </span>
      <p className="max-w-xs text-base" style={{ color: "var(--color-secondary)" }}>
        {t("empty_desc")}
      </p>
      <Link
        href="/plan"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-card)] border px-4 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
        style={{
          color: "var(--color-main)",
          borderColor: "color-mix(in srgb, var(--color-main) 15%, transparent)",
          fontFamily: "var(--font-heading)",
        }}
      >
        <Plus size={18} strokeWidth={2} aria-hidden />
        {t("add_first")}
      </Link>
    </div>
  );
}

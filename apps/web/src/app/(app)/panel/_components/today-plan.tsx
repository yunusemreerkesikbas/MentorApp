"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import { ApiClientError, planTaskControllerUpdate } from "@mentor/api-client";
import { Card, PlanListItem, ProgressBar, SectionHeading } from "@mentor/ui";
import { FormError } from "../../../../components/form";

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
  onTasksChanged?: () => void;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const doneCount = useMemo(() => tasks.filter((t) => t.status === "DONE").length, [tasks]);
  const completion = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);

  async function toggle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task || busyId) return;

    const nextStatus: PlanTaskStatus = task.status === "DONE" ? "PENDING" : "DONE";
    const previous = tasks;

    setError(null);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
    setBusyId(id);

    try {
      const updated = (await planTaskControllerUpdate(id, { status: nextStatus })) as unknown as PlanTaskDto;
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      onTasksChanged?.();
    } catch (err) {
      setTasks(previous);
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Bir hata oluştu.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <SectionHeading
        subtitle={tasks.length > 0 ? `${doneCount} / ${tasks.length} tamamlandı` : undefined}
        action={<AddTaskLink />}
      >
        Bugünün planı
      </SectionHeading>

      <FormError message={error} />

      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-4">
            <ProgressBar value={completion} />
          </div>
          <ul className="mt-3 flex flex-col gap-1">
            {tasks.map((task) => (
              <li key={task.id}>
                <PlanListItem
                  title={task.title}
                  subject={task.subject}
                  done={task.status === "DONE"}
                  onToggle={() => void toggle(task.id)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function AddTaskLink() {
  return (
    <Link
      href="/plan"
      className="flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-card)] px-3 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Görev ekle
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-base" style={{ color: "var(--color-secondary)" }}>
        Bugüne henüz görev eklemedin.
      </p>
      <Link
        href="/plan"
        className="flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-card)] px-4 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        İlk görevini ekle
      </Link>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, PlanListItem, ProgressBar, SectionHeading, TextField } from "@mentor/ui";
import { FormError } from "../../../../components/form";
import { staggerItemVariants, staggerListVariants } from "../../../../lib/stagger-motion";
import {
  createPlanTask,
  deletePlanTask,
  listPlanTasksForDate,
  updatePlanTask,
} from "../../../../lib/plan-tasks";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  const today = todayIso();
  if (iso === today) return "Bugün";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Full plan CRUD — list/create/update/delete tasks for a selected day.
 */
export function PlanShell() {
  const reduceMotion = useReducedMotion();
  const [date, setDate] = useState(todayIso);
  const [tasks, setTasks] = useState<PlanTaskDto[]>([]);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loading = loadedDate !== date;

  useEffect(() => {
    let active = true;
    listPlanTasksForDate(date)
      .then((data) => {
        if (!active) return;
        setTasks(data);
        setLoadedDate(date);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setTasks([]);
        setLoadedDate(date);
        setError(
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Bir hata oluştu.",
        );
      });
    return () => {
      active = false;
    };
  }, [date]);

  const doneCount = useMemo(() => tasks.filter((t) => t.status === "DONE").length, [tasks]);
  const completion = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const visibleTasks = loading ? [] : tasks;
  const visibleDoneCount = loading ? 0 : doneCount;
  const visibleCompletion = visibleTasks.length === 0 ? 0 : completion;

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
      };

  const gridMotion = reduceMotion
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: staggerListVariants,
      };

  async function toggle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task || busyId) return;
    const nextStatus: PlanTaskStatus = task.status === "DONE" ? "PENDING" : "DONE";
    const previous = tasks;
    setError(null);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
    setBusyId(id);
    try {
      const updated = await updatePlanTask(id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
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

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const created = await createPlanTask({
        title: title.trim(),
        taskDate: date,
        ...(subject.trim() ? { subject: subject.trim() } : {}),
      });
      setTasks((prev) => [...prev, created]);
      setTitle("");
      setSubject("");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Bir hata oluştu.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deletePlanTask(id);
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
    <main className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-8 lg:py-10">
      <motion.header className="mb-6" {...headerMotion}>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Çalışma Planı
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Günlük görevlerini ekle, tamamla ve ilerlemeni takip et.
        </p>
      </motion.header>

      <motion.div className="flex flex-col gap-6" {...gridMotion}>
        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDate((d) => shiftDate(d, -1))}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-card)] px-3 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                aria-label="Önceki gün"
              >
                ←
              </button>
              <p
                className="text-center text-base font-bold"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {formatDateLabel(date)}
              </p>
              <button
                type="button"
                onClick={() => setDate((d) => shiftDate(d, 1))}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-card)] px-3 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                aria-label="Sonraki gün"
              >
                →
              </button>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <Card>
            <SectionHeading
              subtitle={
                visibleTasks.length > 0 ? `${visibleDoneCount} / ${visibleTasks.length} tamamlandı` : undefined
              }
            >
              Görevler
            </SectionHeading>

            <FormError message={error} />

            {loading ? (
              <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
                Yükleniyor…
              </p>
            ) : visibleTasks.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <motion.div
                  className="mt-4"
                  key={visibleCompletion}
                  initial={reduceMotion ? false : { opacity: 0.6, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProgressBar value={visibleCompletion} />
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
                  {visibleTasks.map((task) => (
                    <motion.li
                      key={task.id}
                      className="flex items-center gap-2"
                      variants={reduceMotion ? undefined : staggerItemVariants}
                    >
                      <div className="min-w-0 flex-1">
                        <PlanListItem
                          title={task.title}
                          subject={task.subject}
                          done={task.status === "DONE"}
                          onToggle={() => void toggle(task.id)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void remove(task.id)}
                        disabled={busyId === task.id}
                        className="flex min-h-[44px] shrink-0 items-center px-2 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                        style={{ color: "var(--color-secondary)" }}
                        aria-label={`${task.title} görevini sil`}
                      >
                        Sil
                      </button>
                    </motion.li>
                  ))}
                </motion.ul>
              </>
            )}

            <form
              onSubmit={(e) => void addTask(e)}
              className="mt-6 flex flex-col gap-3 border-t border-white/40 pt-6"
            >
              <TextField
                label="Yeni görev"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn. Tarih tekrar"
                maxLength={200}
                required
              />
              <TextField
                label="Ders (isteğe bağlı)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Örn. Tarih"
                maxLength={80}
              />
              <Button type="submit" busy={adding} fullWidth>
                Görev ekle
              </Button>
            </form>
          </Card>
        </motion.div>

        <motion.div variants={reduceMotion ? undefined : staggerItemVariants}>
          <Link
            href="/panel"
            className="flex min-h-[44px] items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            ← Panele dön
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 flex flex-col items-center gap-4 py-6 text-center">
      <span
        className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold capitalize"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
          color: "var(--color-chip-text)",
          fontFamily: "var(--font-body)",
        }}
      >
        Plan boş
      </span>
      <p className="text-base" style={{ color: "var(--color-secondary)" }}>
        Bu güne henüz görev eklemedin. Küçük bir adım bile yeterli.
      </p>
    </div>
  );
}

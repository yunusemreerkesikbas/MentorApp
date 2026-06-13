"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlanTaskDto, PlanTaskStatus } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, PlanListItem, ProgressBar, SectionHeading, TextField } from "@mentor/ui";
import { FormError } from "../../../../components/form";
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
  const [date, setDate] = useState(todayIso);
  const [tasks, setTasks] = useState<PlanTaskDto[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return listPlanTasksForDate(date)
      .then(setTasks)
      .catch((err: unknown) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Bir hata oluştu.",
        ),
      )
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

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
      const updated = (await updatePlanTask(id, { status: nextStatus })) as unknown as PlanTaskDto;
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
      const created = (await createPlanTask({
        title: title.trim(),
        taskDate: date,
        ...(subject.trim() ? { subject: subject.trim() } : {}),
      })) as unknown as PlanTaskDto;
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
      <header className="mb-6">
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          Çalışma Planı
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-secondary)" }}>
          Günlük görevlerini ekle, tamamla ve ilerlemeni takip et.
        </p>
      </header>

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-card)] px-3 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2"
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
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-card)] px-3 text-sm font-semibold transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            aria-label="Sonraki gün"
          >
            →
          </button>
        </div>
      </Card>

      <Card>
        <SectionHeading subtitle={tasks.length > 0 ? `${doneCount} / ${tasks.length} tamamlandı` : undefined}>
          Görevler
        </SectionHeading>

        <FormError message={error} />

        {loading ? (
          <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
            Yükleniyor…
          </p>
        ) : tasks.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: "var(--color-secondary)" }}>
            Bu güne henüz görev eklemedin.
          </p>
        ) : (
          <>
            <div className="mt-4">
              <ProgressBar value={completion} />
            </div>
            <ul className="mt-3 flex flex-col gap-1">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-2">
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
                    className="flex min-h-[44px] shrink-0 items-center px-2 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                    style={{ color: "var(--color-secondary)" }}
                    aria-label={`${task.title} görevini sil`}
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <form onSubmit={(e) => void addTask(e)} className="mt-6 flex flex-col gap-3 border-t border-white/40 pt-6">
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
    </main>
  );
}

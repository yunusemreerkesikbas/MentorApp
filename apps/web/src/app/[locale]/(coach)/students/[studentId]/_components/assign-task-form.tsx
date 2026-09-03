"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, TextAreaField, TextField } from "@mentor/ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { assignTasks, type MentorshipAssignmentDraft } from "@/lib/mentorship";
import { useExamTopicTaxonomy } from "@/lib/use-exam-topic-taxonomy";

/**
 * The week composer: a coach plans a week and sends it in ONE request.
 *
 * The API has taken an array since the assignment slice shipped (`max(21)` — three weeks of days);
 * only the form was single-task. 21 is not re-declared here, it IS the schema's ceiling surfaced
 * as a UI limit, so the two cannot drift.
 *
 * Drafts are grouped by day rather than laid out as a 7-column grid: a grid of four-field cells
 * collapses badly on the tablet a coach actually holds, and "pick a day, add to it" is the same
 * plan with none of the layout.
 */

const DAYS_IN_WEEK = 7;
const MAX_TASKS = 21;
const COACH_NOTE_MAX = 500;

/** Today in the browser's local calendar as `yyyy-mm-dd`. The past is refused server-side. */
function todayLocalIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

interface Draft extends MentorshipAssignmentDraft {
  /** Local-only key: drafts are unsaved rows, so nothing server-side can identify them yet. */
  key: string;
  taskDate: string;
}

export function AssignTaskForm({
  studentId,
  studentName,
  studentExamType,
  onAssigned,
}: {
  studentId: string;
  studentName: string;
  studentExamType: string | null;
  onAssigned: () => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const toast = useMentorToast();

  // The taxonomy follows the STUDENT's exam, never the coach's — a coach may hold students on
  // different tracks, and the wrong topic list is worse than none.
  const { subjects, topicsBySubject, loaded } = useExamTopicTaxonomy(studentExamType);

  const [weekStart, setWeekStart] = useState(todayLocalIso());
  const [selectedDate, setSelectedDate] = useState(todayLocalIso());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [busy, setBusy] = useState(false);

  const days = useMemo(
    () => Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart],
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }),
    [locale],
  );
  const topics = subject === "" ? [] : (topicsBySubject.get(subject) ?? []);
  const atCeiling = drafts.length >= MAX_TASKS;

  function addDraft() {
    const trimmed = title.trim();
    if (trimmed === "" || atCeiling) return;
    setDrafts((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${prev.length}`,
        title: trimmed,
        // A topic without a subject is refused by the API, so the UI never offers the pair.
        subject: subject === "" ? null : subject,
        topic: subject === "" || topic === "" ? null : topic,
        coachNote: coachNote.trim() === "" ? null : coachNote.trim(),
        taskDate: selectedDate,
      },
    ]);
    setTitle("");
    setTopic("");
    setCoachNote("");
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((draft) => draft.key !== key));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (drafts.length === 0) return;
    setBusy(true);
    try {
      // One request, all-or-nothing: a half-written week is worse than a refused one.
      await assignTasks(
        studentId,
        // The local `key` is ours, not the API's — `.strict()` refuses any field it did not ask for.
        drafts.map((draft) => ({
          title: draft.title,
          subject: draft.subject,
          topic: draft.topic,
          coachNote: draft.coachNote,
          taskDate: draft.taskDate,
        })),
      );
      toast.success({
        title: t("assign_done_title"),
        message: t("assign_done_body", { name: studentName, count: drafts.length }),
      });
      setDrafts([]);
      onAssigned();
    } catch (err) {
      toast.error({
        title: common("error_title"),
        message: err instanceof ApiClientError ? err.message : common("error_unknown"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-main)" }}>
        {t("assign_title")}
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("assign_body")}
      </p>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setWeekStart(todayLocalIso())}
            disabled={weekStart === todayLocalIso()}
          >
            {t("assign_week_this")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setWeekStart(addDaysIso(weekStart, DAYS_IN_WEEK))}
          >
            {t("assign_week_next")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("assign_week_pick")}>
          {days.map((day) => {
            const count = drafts.filter((draft) => draft.taskDate === day).length;
            const active = day === selectedDate;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedDate(day)}
                className="min-h-11 rounded-[var(--radius-card)] border px-3 text-xs focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{
                  borderColor: active ? "var(--color-main)" : "var(--color-border)",
                  background: active ? "var(--color-main)" : "var(--color-bg)",
                  color: active ? "var(--color-bg)" : "var(--color-main)",
                }}
              >
                {dayFormat.format(new Date(`${day}T00:00:00`))}
                {count > 0 ? ` · ${count}` : ""}
              </button>
            );
          })}
        </div>

        <TextField
          label={t("assign_task_title")}
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TaxonomySelect
            label={t("assign_subject")}
            value={subject}
            placeholder={t("assign_subject_none")}
            options={subjects}
            disabled={!loaded || subjects.length === 0}
            onChange={(next) => {
              setSubject(next);
              // The old topic belongs to the old subject; keeping it would send a mismatched pair.
              setTopic("");
            }}
          />
          <TaxonomySelect
            label={t("assign_topic")}
            value={topic}
            placeholder={t("assign_topic_none")}
            options={topics}
            disabled={subject === "" || topics.length === 0}
            onChange={setTopic}
          />
        </div>

        <TextAreaField
          label={t("assign_note")}
          hint={t("assign_note_hint")}
          value={coachNote}
          rows={2}
          maxLength={COACH_NOTE_MAX}
          onChange={(event) => setCoachNote(event.target.value)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={addDraft}
            disabled={title.trim() === "" || atCeiling}
          >
            {t("assign_add_to_day")}
          </Button>
          <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
            {t("assign_count", { count: drafts.length, max: MAX_TASKS })}
          </span>
        </div>

        {drafts.length > 0 ? (
          <ul className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
            {days
              .filter((day) => drafts.some((draft) => draft.taskDate === day))
              .map((day) => (
                <li key={day}>
                  <p className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
                    {dayFormat.format(new Date(`${day}T00:00:00`))}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {drafts
                      .filter((draft) => draft.taskDate === day)
                      .map((draft) => (
                        <li
                          key={draft.key}
                          className="flex items-baseline justify-between gap-2 text-sm"
                        >
                          <span style={{ color: "var(--color-main)" }}>
                            {draft.title}
                            {draft.subject ? (
                              <span style={{ color: "var(--color-secondary)" }}>
                                {" · "}
                                {draft.subject}
                                {draft.topic ? ` › ${draft.topic}` : ""}
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDraft(draft.key)}
                            className="shrink-0 text-xs underline-offset-4 hover:underline"
                            style={{ color: "var(--color-secondary)" }}
                          >
                            {t("assign_remove")}
                          </button>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
          </ul>
        ) : null}

        <div>
          <Button type="submit" busy={busy} disabled={drafts.length === 0}>
            {t("assign_action", { count: drafts.length })}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * A native `<select>`: it opens the platform's own picker, is keyboard- and screen-reader-correct
 * for free, and costs no bundle. A combobox library for two dropdowns would never earn its weight.
 */
function TaxonomySelect({
  label,
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm text-[var(--color-main)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

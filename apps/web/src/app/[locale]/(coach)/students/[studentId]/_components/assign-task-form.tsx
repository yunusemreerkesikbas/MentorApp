"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipProgramTemplateDto,
  MentorshipReportPlanTaskDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card, TextAreaField, TextField } from "@mentor/ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { assignTasks, type MentorshipAssignmentDraft } from "@/lib/mentorship";
import { useExamTopicTaxonomy } from "@/lib/use-exam-topic-taxonomy";
import { ComposerSelect, labelOptions } from "./composer-select";
import { addDaysIso, todayLocalIso } from "./composer-dates";
import { buildRepeatDrafts } from "./repeat-week";
import { TemplateBar } from "./template-bar";
import { buildTemplateDrafts } from "./template-apply";

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

interface Draft extends MentorshipAssignmentDraft {
  /** Local-only key: drafts are unsaved rows, so nothing server-side can identify them yet. */
  key: string;
  taskDate: string;
}

export function AssignTaskForm({
  studentId,
  studentName,
  studentExamType,
  previousTasks,
  onAssigned,
}: {
  studentId: string;
  studentName: string;
  studentExamType: string | null;
  /** The report's plan rows, already loaded by the page — the source for "copy last week". */
  previousTasks: readonly MentorshipReportPlanTaskDto[];
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
  const today = todayLocalIso();
  // Asking for one draft is enough to know whether the button has anything to do.
  const canRepeat =
    !atCeiling && buildRepeatDrafts(previousTasks, days, today, 1).length > 0;

  function repeatWeek() {
    const copied = buildRepeatDrafts(previousTasks, days, today, MAX_TASKS - drafts.length);
    // Appended, never substituted: whatever the coach already composed stays.
    setDrafts((prev) => [
      ...prev,
      ...copied.map((draft, index) => ({ ...draft, key: `repeat-${Date.now()}-${index}` })),
    ]);
  }

  /**
   * A saved program becomes drafts, anchored on the week the composer is showing. Nothing is
   * written until the coach submits, which is the point: a template built for another exam has its
   * topics dropped here, and the coach can see and fix that before it reaches a student's plan.
   */
  function loadTemplate(template: MentorshipProgramTemplateDto) {
    const load = buildTemplateDrafts(
      template,
      days[0]!,
      studentExamType,
      MAX_TASKS - drafts.length,
    );
    setDrafts((prev) => [
      ...prev,
      ...load.drafts.map((draft, index) => ({
        ...draft,
        key: `template-${Date.now()}-${index}`,
      })),
    ]);
    // Say what was thinned. A template that quietly loses half its tasks is worse than one that
    // refuses to load, because the coach assigns the remainder believing it is the whole program.
    if (load.clearedTopics > 0 || load.skipped > 0) {
      toast.info({
        title: t("template_loaded", { name: template.name }),
        message:
          load.clearedTopics > 0
            ? t("template_topics_cleared", { count: load.clearedTopics })
            : t("template_skipped", { count: load.skipped }),
      });
    }
  }

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
        <TemplateBar
          drafts={drafts}
          examType={studentExamType}
          disabled={busy || atCeiling}
          onLoad={loadTemplate}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setWeekStart(today)}
            disabled={weekStart === today}
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
          <Button type="button" variant="secondary" onClick={repeatWeek} disabled={!canRepeat}>
            {t("assign_repeat_week")}
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
          <ComposerSelect
            label={t("assign_subject")}
            value={subject}
            placeholder={t("assign_subject_none")}
            options={labelOptions(subjects)}
            disabled={!loaded || subjects.length === 0}
            onChange={(next) => {
              setSubject(next);
              // The old topic belongs to the old subject; keeping it would send a mismatched pair.
              setTopic("");
            }}
          />
          <ComposerSelect
            label={t("assign_topic")}
            value={topic}
            placeholder={t("assign_topic_none")}
            options={labelOptions(topics)}
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

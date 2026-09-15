"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipProgramTemplateDto,
  MentorshipReportPlanTaskDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextAreaField, TextField } from "@mentor/ui";
import { CoachOverlayBody, CoachOverlayFooter } from "@/components/coach-overlay";
import {
  INSET_DIVIDE_CLASS,
  INSET_GROUP_CLASS,
  INSET_ROW_CLASS,
  NOTE_CLASS,
  SUBHEAD_CLASS,
} from "@/components/mentorship/coach-ui";
import { useMentorToast } from "@/lib/mentor-toast";
import { assignTasks, type MentorshipAssignmentDraft } from "@/lib/mentorship";
import { useExamTopicTaxonomy } from "@/lib/use-exam-topic-taxonomy";
import { ComposerDayPicker } from "./composer-day-picker";
import { ComposerSelect, labelOptions } from "./composer-select";
import { addDaysIso, todayLocalIso } from "./composer-dates";
import { buildRepeatDrafts } from "./repeat-week";
import {
  SuggestButton,
  TemplateLoadSelect,
  TemplateSaveRow,
  useProgramTemplates,
} from "./template-bar";
import { buildTemplateDrafts } from "./template-apply";

/**
 * The week composer: a coach plans a week and sends it in ONE request. It is the body of the
 * "Haftayı planla" panel. The panel unmounts when it closes, so the drafts are owned by the report
 * shell and passed in: a half-built week survives closing it, or a stray swipe on the phone sheet.
 *
 * The API has taken an array since the assignment slice shipped (`max(21)` — three weeks of days);
 * only the form was single-task. 21 is not re-declared here, it IS the schema's ceiling surfaced
 * as a UI limit, so the two cannot drift.
 *
 * Drafts are listed by day rather than laid out as a 7-column grid: a grid of four-field cells
 * collapses badly on the tablet a coach actually holds, and "pick a day, add to it" is the same
 * plan with none of the layout.
 */

const DAYS_IN_WEEK = 7;
const MAX_TASKS = 21;
const COACH_NOTE_MAX = 500;
const SMALL_BUTTON = "min-h-11";

export interface AssignDraft extends MentorshipAssignmentDraft {
  /** Local-only key: drafts are unsaved rows, so nothing server-side can identify them yet. */
  key: string;
  taskDate: string;
}

export function AssignTaskForm({
  studentId,
  studentName,
  studentExamType,
  previousTasks,
  drafts,
  onDraftsChange: setDrafts,
  busy,
  onBusyChange: setBusy,
  onAssigned,
  onCancel,
}: {
  studentId: string;
  studentName: string;
  studentExamType: string | null;
  /** The report's plan rows, already loaded by the page — the source for "copy last week". */
  previousTasks: readonly MentorshipReportPlanTaskDto[];
  drafts: readonly AssignDraft[];
  onDraftsChange: Dispatch<SetStateAction<AssignDraft[]>>;
  /** Owned by the shell, which also locks the panel: closing mid-send would remount an idle form. */
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onAssigned: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const locale = useLocale();
  const toast = useMentorToast();
  const [templates, setTemplates] = useProgramTemplates();

  // The taxonomy follows the STUDENT's exam, never the coach's — a coach may hold students on
  // different tracks, and the wrong topic list is worse than none.
  const { subjects, topicsBySubject, loaded } = useExamTopicTaxonomy(studentExamType);

  const [weekStart, setWeekStart] = useState(todayLocalIso());
  const [selectedDate, setSelectedDate] = useState(todayLocalIso());
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [coachNote, setCoachNote] = useState("");

  const days = useMemo(
    () => Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart],
  );
  const counts = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const draft of drafts) byDay.set(draft.taskDate, (byDay.get(draft.taskDate) ?? 0) + 1);
    return byDay;
  }, [drafts]);
  const ordered = useMemo(
    () => [...drafts].sort((a, b) => a.taskDate.localeCompare(b.taskDate)),
    [drafts],
  );
  const selectedFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
    [locale],
  );
  const shortFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" }),
    [locale],
  );
  const topics = subject === "" ? [] : (topicsBySubject.get(subject) ?? []);
  const atCeiling = drafts.length >= MAX_TASKS;
  const today = todayLocalIso();
  // Asking for one draft is enough to know whether the button has anything to do.
  const canRepeat =
    !atCeiling && buildRepeatDrafts(previousTasks, days, today, 1).length > 0;

  /** Moving the week moves the selection with it, so a draft never lands on a day out of view. */
  function showWeek(start: string) {
    setWeekStart(start);
    setSelectedDate(start);
  }

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
    const load = buildTemplateDrafts(template, days[0]!, studentExamType, MAX_TASKS - drafts.length);
    setDrafts((prev) => [
      ...prev,
      ...load.drafts.map((draft, index) => ({ ...draft, key: `template-${Date.now()}-${index}` })),
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
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <CoachOverlayBody>
        <div className="flex flex-col gap-5 pb-4">
          <section className="flex flex-col gap-2">
            <h3 className={SUBHEAD_CLASS}>{t("assign_quick_start")}</h3>
            <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
              <Button
                type="button"
                variant="soft"
                size="sm"
                fullWidth
                className={SMALL_BUTTON}
                onClick={repeatWeek}
                disabled={busy || !canRepeat}
              >
                {t("assign_repeat_week")}
              </Button>
              <TemplateLoadSelect templates={templates} disabled={busy || atCeiling} onLoad={loadTemplate} />
              <SuggestButton studentId={studentId} disabled={busy || atCeiling} onLoad={loadTemplate} />
            </div>
            <p className={NOTE_CLASS}>{t("suggest_hint")}</p>
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={SUBHEAD_CLASS}>{t("assign_week_pick")}</h3>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={SMALL_BUTTON}
                  onClick={() => showWeek(today)}
                  disabled={weekStart === today}
                >
                  {t("assign_week_this")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={SMALL_BUTTON}
                  onClick={() => showWeek(addDaysIso(weekStart, DAYS_IN_WEEK))}
                >
                  {t("assign_week_next")}
                </Button>
              </div>
            </div>
            <ComposerDayPicker
              days={days}
              selectedDate={selectedDate}
              counts={counts}
              onSelect={setSelectedDate}
            />
          </section>

          <section className={`${INSET_GROUP_CLASS} flex flex-col gap-4 p-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="coach-headline text-[var(--color-main)]">
                {selectedFormat.format(new Date(`${selectedDate}T00:00:00`))}
              </h3>
              <span className="text-xs tabular-nums" style={{ color: "var(--color-secondary)" }}>
                {t("assign_count", { count: drafts.length, max: MAX_TASKS })}
              </span>
            </div>
            <TextField
              dense
              label={t("assign_task_title")}
              value={title}
              maxLength={200}
              data-autofocus=""
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
              dense
              label={t("assign_note")}
              hint={t("assign_note_hint")}
              value={coachNote}
              rows={2}
              maxLength={COACH_NOTE_MAX}
              onChange={(event) => setCoachNote(event.target.value)}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="soft"
                size="sm"
                className={SMALL_BUTTON}
                onClick={addDraft}
                disabled={busy || title.trim() === "" || atCeiling}
              >
                {t("assign_add_to_day")}
              </Button>
            </div>
          </section>

          {ordered.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className={SUBHEAD_CLASS}>{t("assign_in_program")}</h3>
              <ul className={`${INSET_GROUP_CLASS} ${INSET_DIVIDE_CLASS}`}>
                {ordered.map((draft) => (
                  <li key={draft.key} className={`${INSET_ROW_CLASS} items-start`}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="coach-body text-[var(--color-main)]">{draft.title}</span>
                      <span className="coach-footnote text-[var(--color-secondary)]">
                        {[
                          shortFormat.format(new Date(`${draft.taskDate}T00:00:00`)),
                          draft.subject ? [draft.subject, draft.topic].filter(Boolean).join(" › ") : null,
                          draft.coachNote,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={SMALL_BUTTON}
                      disabled={busy}
                      onClick={() => removeDraft(draft.key)}
                    >
                      {t("assign_remove")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <TemplateSaveRow
            templates={templates}
            setTemplates={setTemplates}
            drafts={drafts}
            examType={studentExamType}
            disabled={busy}
          />
        </div>
      </CoachOverlayBody>

      <CoachOverlayFooter>
        <Button type="button" variant="secondary" size="sm" className={SMALL_BUTTON} disabled={busy} onClick={onCancel}>
          {t("confirm_cancel")}
        </Button>
        <Button type="submit" size="sm" className={SMALL_BUTTON} busy={busy} disabled={drafts.length === 0}>
          {t("assign_action", { count: drafts.length })}
        </Button>
      </CoachOverlayFooter>
    </form>
  );
}

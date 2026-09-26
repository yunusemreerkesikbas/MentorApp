"use client";
import { useId, type Ref } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, TextAreaField, TextField, TextSwap } from "@mentor/ui";
import { mentorshipAssignmentTaskSchema } from "@mentor/validation";
import { DateField } from "@/components/date-field";
import { PANEL_QUIET_BUTTON } from "@/components/mentorship/coach-ui";
import { TaxonomyCascadeSelect } from "@/components/taxonomy-cascade-select";
import { todayInIstanbul } from "@/lib/date-time";
import { useExamTopicTaxonomy } from "@/lib/use-exam-topic-taxonomy";
import {
  assignmentInput,
  MAX_DAYS_AHEAD,
  shiftDate,
  type AssignDraft,
} from "./planning-state";
import { PLANNER_SUBHEAD } from "./planning-week";

/**
 * The planner's always-open task form. It adds a new task to the chosen day, or, after "Düzenle"
 * on a draft, edits that draft in place. It holds nothing of its own: the draft lives in the
 * planning state, so a panel closed mid-sentence opens again on the same words.
 */
export function PlanningComposer({
  draft,
  mode,
  day,
  dirty,
  examType,
  studentName,
  titleRef,
  onChange,
  onCommit,
  onReset,
}: {
  /** `null` is a blank new task on `day`. */
  draft: AssignDraft | null;
  mode: "new" | "edit";
  day: string;
  /** Whether the form holds something worth keeping (see `hasUnsavedInput`). */
  dirty: boolean;
  examType: string | null;
  /** First name, for the note's hint. */
  studentName: string;
  titleRef?: Ref<HTMLInputElement>;
  onChange: (draft: AssignDraft) => void;
  onCommit: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("mentorship");
  const headingId = useId();
  const taxonomy = useExamTopicTaxonomy(examType);
  const today = todayInIstanbul();
  const limit = shiftDate(today, MAX_DAYS_AHEAD);
  const value: AssignDraft = draft ?? {
    key: "",
    taskDate: day,
    title: "",
    subject: null,
    topic: null,
    coachNote: null,
  };
  // The first keystroke gives a new task its key; until then the form is simply empty.
  const change = (patch: Partial<AssignDraft>) =>
    onChange({ ...value, key: value.key || crypto.randomUUID(), ...patch });
  const outOfRange = value.taskDate < today || value.taskDate > limit;
  const valid = mentorshipAssignmentTaskSchema.safeParse(assignmentInput(value)).success && !outOfRange;

  return (
    <section className="flex flex-col gap-3" aria-labelledby={headingId}>
      <h3 id={headingId} className={PLANNER_SUBHEAD}>
        <TextSwap text={t(mode === "edit" ? "planning_edit_task" : "planning_new_task")} />
      </h3>
      <TextField
        ref={titleRef}
        dense
        label={t("assign_task_title")}
        value={value.title}
        maxLength={200}
        onChange={(event) => change({ title: event.target.value })}
      />
      <TaxonomyCascadeSelect
        subjects={taxonomy.subjectRows}
        topics={taxonomy.topicRows}
        subjectValue={value.subject ?? ""}
        topicValue={value.topic ?? ""}
        valueMode="name"
        layout="grid"
        textSize="sm"
        // The same label as the task, date and note fields beside it.
        labelClassName="text-xs font-semibold text-[var(--color-secondary)] font-[family-name:var(--font-heading)]"
        hideTopicWhenEmpty={false}
        disabled={!taxonomy.loaded}
        subjectLabel={t("assign_subject")}
        emptySubjectLabel={t("assign_subject_none")}
        topicLabel={t("assign_topic")}
        emptyTopicLabel={t("assign_topic_none")}
        onSubjectChange={(subject) => change({ subject: subject || null, topic: null })}
        onTopicChange={(topic) => change({ topic: topic || null })}
      />
      <div className="sm:max-w-[calc(50%-0.375rem)]">
        <DateField
          display="long"
          label={t("planning_date")}
          value={value.taskDate}
          min={today}
          onChange={(taskDate) => change({ taskDate })}
        />
      </div>
      <TextAreaField
        dense
        label={t("assign_note")}
        hint={t("assign_note_hint", { name: studentName })}
        value={value.coachNote ?? ""}
        maxLength={500}
        onChange={(event) => change({ coachNote: event.target.value || null })}
      />
      {outOfRange ? (
        <p role="alert" className="text-body-sm font-semibold text-[var(--color-danger)]">
          {t("planning_invalid_date")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Outlined: the panel's one filled button is the send at its foot. */}
        <Button type="button" variant="secondary" size="sm" disabled={!valid} onClick={onCommit}>
          {mode === "edit" ? null : <Plus className="size-4" aria-hidden />}
          {t(mode === "edit" ? "planning_save_change" : "planning_add_draft")}
        </Button>
        {mode === "edit" || dirty ? (
          <button type="button" className={PANEL_QUIET_BUTTON} onClick={onReset}>
            {mode === "edit" ? t("confirm_cancel") : t("planning_clear")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

"use client";
import { useTranslations } from "next-intl";
import { Button, TextField, TextAreaField } from "@mentor/ui";
import { DateField } from "@/components/date-field";
import { TaxonomyCascadeSelect } from "@/components/taxonomy-cascade-select";
import { useExamTopicTaxonomy } from "@/lib/use-exam-topic-taxonomy";
import { todayInIstanbul } from "@/lib/date-time";
import { mentorshipAssignmentTaskSchema } from "@mentor/validation";
import {
  shiftDate,
  assignmentInput,
  MAX_DAYS_AHEAD,
  type AssignDraft,
} from "./planning-state";
import { PLANNER_SUBHEAD } from "./planning-week";

export function PlanningEditor({
  draft,
  examType,
  onChange,
  onSave,
  onCancel,
}: {
  draft: AssignDraft;
  examType: string | null;
  onChange: (draft: AssignDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("mentorship");
  const taxonomy = useExamTopicTaxonomy(examType);
  const input = assignmentInput(draft);
  const today = todayInIstanbul();
  const valid =
    mentorshipAssignmentTaskSchema.safeParse(input).success &&
    draft.taskDate >= today &&
    draft.taskDate <= shiftDate(today, MAX_DAYS_AHEAD);
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface-container)] p-4">
      <h3 className={PLANNER_SUBHEAD}>{t("planning_edit")}</h3>
      <TextField
        autoFocus
        dense
        label={t("assign_task_title")}
        value={draft.title}
        maxLength={200}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
      />
      <DateField
        label={t("planning_date")}
        value={draft.taskDate}
        min={today}
        onChange={(taskDate) => onChange({ ...draft, taskDate })}
      />
      <TaxonomyCascadeSelect
        subjects={taxonomy.subjectRows}
        topics={taxonomy.topicRows}
        subjectValue={draft.subject ?? ""}
        topicValue={draft.topic ?? ""}
        valueMode="name"
        layout="grid"
        textSize="sm"
        hideTopicWhenEmpty={false}
        disabled={!taxonomy.loaded}
        subjectLabel={t("assign_subject")}
        emptySubjectLabel={t("assign_subject_none")}
        topicLabel={t("assign_topic")}
        emptyTopicLabel={t("assign_topic_none")}
        onSubjectChange={(subject) =>
          onChange({ ...draft, subject: subject || null, topic: null })
        }
        onTopicChange={(topic) => onChange({ ...draft, topic: topic || null })}
      />
      <TextAreaField
        dense
        label={t("assign_note")}
        hint={t("assign_note_hint")}
        value={draft.coachNote ?? ""}
        maxLength={500}
        onChange={(e) =>
          onChange({ ...draft, coachNote: e.target.value || null })
        }
      />
      {(draft.taskDate < today ||
        draft.taskDate > shiftDate(today, MAX_DAYS_AHEAD)) && (
        <p role="alert" className="text-body-sm font-semibold text-[var(--color-danger)]">
          {t("planning_invalid_date")}
        </p>
      )}
      <div className="flex gap-2">
        {/* Outlined: the panel's one filled button is the send at its foot. */}
        <Button type="button" variant="secondary" size="sm" disabled={!valid} onClick={onSave}>
          {t("planning_save_draft")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("confirm_cancel")}
        </Button>
      </div>
    </section>
  );
}

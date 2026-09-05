import type { MentorshipProgramTemplateTaskDto } from "@mentor/types";
import type { MentorshipAssignmentDraft } from "@/lib/mentorship";
import { addDaysIso, daysBetweenIso } from "./composer-dates";

/**
 * Saved programs, both directions.
 *
 * A template is a saved DRAFT, never a second write path: loading one fills the composer and the
 * coach still submits through `POST /students/:id/assignments`. That is what keeps the composer's
 * subject/topic picker as the only gate on taxonomy — the server checks that a topic HAS a subject
 * (`refinePlanTaskTaxonomy`) but never that the topic exists in this student's exam.
 */

export type DatedDraft = MentorshipAssignmentDraft & { taskDate: string };

/**
 * Drafts → template tasks, normalized so the earliest day becomes 0.
 *
 * Normalizing rather than storing the composed dates is what makes the template re-datable: the
 * coach saved "a program", not "the week of the 8th". Drafts may already span more than one week
 * (stepping the week button leaves earlier ones in place), which is why `dayIndex` runs to 20.
 */
export function toTemplateTasks(
  drafts: readonly DatedDraft[],
): MentorshipProgramTemplateTaskDto[] {
  if (drafts.length === 0) return [];
  const first = drafts.reduce(
    (earliest, draft) => (draft.taskDate < earliest ? draft.taskDate : earliest),
    drafts[0]!.taskDate,
  );
  return drafts
    .map((draft) => ({
      dayIndex: daysBetweenIso(first, draft.taskDate),
      title: draft.title,
      subject: draft.subject ?? null,
      topic: draft.topic ?? null,
      coachNote: draft.coachNote ?? null,
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex);
}

export interface TemplateLoad {
  drafts: DatedDraft[];
  /** Tasks left behind because the 21-draft ceiling was reached. Reported, never silent. */
  skipped: number;
  /** Topics dropped because the template was built against a different exam's taxonomy. */
  clearedTopics: number;
}

/**
 * Template → drafts anchored on `anchorIso` (the first day of the week the composer is showing).
 *
 * When the template was saved for a different exam than this student sits, its topics are DROPPED
 * rather than carried: `topic` is a soft ref into the content taxonomy and the API validates only
 * that it has a subject, so a KPSS topic would be written verbatim onto a YKS student's plan and
 * read back to the coach as if it meant something. The count comes back so the UI can say what it
 * did — a silently thinned template is the kind of quiet lie this module exists to avoid.
 *
 * Subjects survive the mismatch: they are broad labels the coach can also type by hand, and the
 * composer's picker lets them fix one. Only the branch below a subject is exam-specific.
 */
export function buildTemplateDrafts(
  template: { examType: string | null; tasks: readonly MentorshipProgramTemplateTaskDto[] },
  anchorIso: string,
  studentExamType: string | null,
  capacity: number,
): TemplateLoad {
  if (capacity <= 0) {
    return { drafts: [], skipped: template.tasks.length, clearedTopics: 0 };
  }
  const examMismatch = template.examType !== null && template.examType !== studentExamType;
  const taken = [...template.tasks]
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .slice(0, capacity);

  let clearedTopics = 0;
  // Keyless, like `buildRepeatDrafts`: the local row key belongs to the component that renders
  // the list, not to the data it renders.
  const drafts = taken.map((task): DatedDraft => {
    const dropTopic = examMismatch && task.topic !== null;
    if (dropTopic) clearedTopics += 1;
    return {
      title: task.title,
      subject: task.subject,
      topic: dropTopic ? null : task.topic,
      coachNote: task.coachNote,
      taskDate: addDaysIso(anchorIso, task.dayIndex),
    };
  });

  return { drafts, skipped: template.tasks.length - taken.length, clearedTopics };
}

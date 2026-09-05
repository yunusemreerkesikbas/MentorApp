import { createHash } from "node:crypto";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { promptLanguageInstruction, type PromptLocale } from "./prompt-locale";

/**
 * The coach's AI brief (W8) — the one prompt in this module that does NOT address the student.
 *
 * Every other prompt here speaks to the person it is about ("sen"), through
 * `companionPromptSystem` / `companionCoachOpening`. This one is written for a third party about
 * someone else, which is a different job and a different register: an operator reading a work
 * queue, not a companion. It deliberately does not reuse the companion opening — borrowing that
 * warmth would produce a brief that sounds like it is talking to the student.
 *
 * The evidence is `MentorshipStudentReportDto` and nothing else. That DTO is already the
 * trust-line contract (`coaching/domain/cohort-evidence.ts`): numbers, dates, statuses and task
 * headings, with the student's own words absent by construction. Passing anything richer here
 * would turn the LLM into a laundering path around the exact line that file draws.
 */
export const MENTORSHIP_BRIEF_PROMPT_VERSION = "v1";

/** How many rows of each list travel. A brief is a paragraph, not a data dump. */
const TREND_LIMIT = 5;
const TASK_LIMIT = 20;
/**
 * Subject rows and dropped titles are capped too. The report bounds them loosely — a mock can
 * carry many subjects and `MENTORSHIP_DROPPED_LIMIT` allows 60 dropped titles — and an unbounded
 * list here turns into tokens the coach never asked for, or a request the model refuses outright.
 */
const SUBJECT_LIMIT = 8;
const DROPPED_LIMIT = 8;

export interface MentorshipBriefEvidence {
  examType: string | null;
  riskFlags: string[];
  activity: MentorshipStudentReportDto["activity"];
  planCompletionRate7d: number | null;
  mockTrend: { takenAt: string; totalNet: number }[];
  latestMockSubjects: { subjectRef: string; net: number; wrong: number; blank: number }[];
  moodTrend: { date: string; level: number }[];
  planTasks: { taskDate: string; title: string; subject: string | null; status: string; assignedByCoach: boolean }[];
  droppedAssignments: { taskDate: string; title: string }[];
}

/**
 * Shape the report into what the model is allowed to read.
 *
 * Names are stripped on purpose: the brief is about a pattern, and a model that has been handed a
 * name starts writing about a person it thinks it knows. `coachNote` is stripped too — it is the
 * coach's own sentence, and feeding it back invites the model to agree with it instead of
 * reading the numbers.
 */
export function buildMentorshipBriefEvidence(
  report: MentorshipStudentReportDto,
): MentorshipBriefEvidence {
  return {
    examType: report.studentExamType,
    riskFlags: [...report.riskFlags],
    activity: report.activity,
    planCompletionRate7d: report.planCompletionRate7d,
    mockTrend: report.mockTrend
      .slice(0, TREND_LIMIT)
      .map((mock) => ({ takenAt: mock.takenAt, totalNet: mock.totalNet })),
    latestMockSubjects: report.latestMockSubjects.slice(0, SUBJECT_LIMIT).map((subject) => ({
      subjectRef: subject.subjectRef,
      net: subject.net,
      wrong: subject.wrong,
      blank: subject.blank,
    })),
    moodTrend: report.moodTrend.slice(-TREND_LIMIT),
    planTasks: report.planTasks.slice(0, TASK_LIMIT).map((task) => ({
      taskDate: task.taskDate,
      title: task.title,
      subject: task.subject,
      status: task.status,
      assignedByCoach: task.assignedByCoach,
    })),
    droppedAssignments: report.droppedAssignments.slice(0, DROPPED_LIMIT).map((dropped) => ({
      taskDate: dropped.taskDate,
      title: dropped.title,
    })),
  };
}

/**
 * Cache key for a brief: same report + same locale + same prompt version → same text.
 *
 * Hashing the shaped evidence rather than the raw report means a field the brief never sees
 * cannot invalidate it, and bumping {@link MENTORSHIP_BRIEF_PROMPT_VERSION} invalidates every
 * cached brief at once — which is the point of the version living inside the hash.
 */
export function mentorshipBriefFingerprint(
  report: MentorshipStudentReportDto,
  locale: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: MENTORSHIP_BRIEF_PROMPT_VERSION,
        locale,
        evidence: buildMentorshipBriefEvidence(report),
      }),
    )
    .digest("hex");
}

const TR_RULES = [
  "Sen bir sınav koçunun asistanısın. Koça, takip ettiği bir öğrenci hakkında kısa bir brifing yazıyorsun.",
  "Koça 'sen' diye hitap et. Öğrenciye asla hitap etme; ondan üçüncü tekil şahısla söz et.",
  "Üç bölüm yaz, her biri en fazla iki cümle: (1) bu hafta ne oldu, (2) neden dikkat gerektiriyor, (3) koç ne yapabilir.",
  "Yalnızca sana verilen JSON'daki sayılara dayan. Veride olmayan hiçbir şeyi uydurma.",
  "riskFlags dizisi arka uçta kural temelli hesaplanmıştır. Onları yeniden adlandırma, sıralama, çelişme veya yenisini icat etme.",
  "moodTrend bir puan dizisidir, teşhis değil. Ruh sağlığı yorumu yapma, tanı koyma, kişilik özelliği çıkarma.",
  "Sınav tarihi, başvuru süreci veya yerleştirme gibi resmi bilgi ÜRETME.",
  "Veri yetersizse bunu açıkça söyle; tahmin yürütme.",
  "Madde işareti kullanma, düz paragraflar yaz. Toplam 90 kelimeyi aşma.",
];

const EN_RULES = [
  "You assist an exam coach. You are writing a short brief about one student they follow.",
  "Address the coach as 'you'. Never address the student; refer to them in the third person.",
  "Write three parts, at most two sentences each: (1) what happened this week, (2) why it needs attention, (3) what the coach can do.",
  "Rely only on the numbers in the JSON provided. Invent nothing that is not in the data.",
  "The riskFlags array is computed by deterministic backend rules. Never rename, reorder, contradict or invent them.",
  "moodTrend is a series of scores, not a diagnosis. Do not interpret mental health, diagnose, or infer personality traits.",
  "Never produce official information such as exam dates, application process or placement.",
  "If the data is too thin, say so plainly rather than guessing.",
  "No bullet points, plain paragraphs. Stay under 90 words in total.",
];

export function buildMentorshipBriefPrompt(
  evidence: MentorshipBriefEvidence,
  locale: PromptLocale,
): { system: string; user: string } {
  return {
    system: [
      promptLanguageInstruction(locale),
      ...(locale === "en" ? EN_RULES : TR_RULES),
    ].join("\n"),
    user: JSON.stringify(evidence),
  };
}

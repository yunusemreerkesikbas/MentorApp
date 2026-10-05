import { createHash } from "node:crypto";
import type {
  MentorshipBriefDeltaDto,
  MentorshipStudentReportDto,
} from "@mentor/types";
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
 *
 * v2 (APP-093) adds one more input and deliberately withholds another. It adds `delta`, the
 * rule-computed movement since the previous brief, so the opening sentence can be about what
 * CHANGED rather than starting from a standing start every week. It withholds the previous brief's
 * TEXT, for the same reason `buildMentorshipBriefEvidence` strips `coachNote` below: a model handed
 * a sentence agrees with it instead of reading the numbers, and a model handed its OWN last
 * sentence would confirm a drifted reading every week until nobody could tell where it came from.
 */
export const MENTORSHIP_BRIEF_PROMPT_VERSION = "v2";

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
    // Newest-first (`coaching/domain/cohort-evidence.ts`), so the most recent rows are at the
    // FRONT. This read `slice(-TREND_LIMIT)` until APP-093, which over a 14-day mood window handed
    // the model the five OLDEST check-ins and then asked it what happened this week.
    moodTrend: report.moodTrend.slice(0, TREND_LIMIT),
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
 *
 * The delta is NOT in here, and must not be. It is measured against the PREVIOUS brief, so writing
 * one moves it: hashing it would mean the key for an unchanged report changed the moment the brief
 * it describes was stored, and every second call would miss the cache and buy the same text twice.
 * The report is what decides whether there is anything new to say; the delta only shapes how it is
 * said.
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

/**
 * Extra rules that apply only when a previous brief exists. Kept separate so the first brief of a
 * relationship is prompted exactly as it was in v1 — there is no delta to talk about, and a rule
 * telling the model to describe change would invite it to invent some.
 */
const TR_DELTA_RULES = [
  "Sana bir de 'delta' verildi: bir önceki brifingten bu yana neyin değiştiği. Birinci bölümü bu haftanın özeti yerine BU DEĞİŞİMLE aç.",
  "delta arka uçta kural temelli hesaplanmıştır. Sayılarını değiştirme, çelişme veya orada olmayan bir değişim ekleme.",
  "delta.coachActions koçun bu arada yaptıklarıdır. Varsa bunu anarak yaz; 'sen' zaten koç demek.",
  "Nedensellik iddia etme. 'Ödev verdikten sonra tamamlama yükseldi' de; 'ödev verdiğin için yükseldi' deme.",
  "delta.quiet true ise bunu sakince söyle ve uydurulmuş bir hareket arama.",
  "Önceki brifingin metni sana verilmedi. 'Geçen sefer yazdığım gibi' türü, elinde olmayan bir metne atıf yapma.",
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

/** The English half of {@link TR_DELTA_RULES}; applied on exactly the same condition. */
const EN_DELTA_RULES = [
  "You are also given a 'delta': what changed since the previous brief. Open part (1) with that change rather than with a summary of the week.",
  "The delta is computed by deterministic backend rules. Never alter its numbers, contradict it, or add a change it does not contain.",
  "delta.coachActions is what the coach did in between. Mention it when present; 'you' already means the coach.",
  "Never claim causation. Say 'after the tasks were assigned, completion rose'; never 'completion rose because you assigned them'.",
  "When delta.quiet is true, say so calmly instead of hunting for movement that is not there.",
  "You were not given the previous brief's text. Never refer back to wording you do not have.",
];

/**
 * `delta` is null on the first brief of a relationship period, and then the prompt is v1's exactly:
 * no delta key in the payload and no delta rules in the system message. "Nothing changed" and
 * "there was nothing to compare" are different statements, and only the first is a brief's to make.
 */
export function buildMentorshipBriefPrompt(
  evidence: MentorshipBriefEvidence,
  delta: MentorshipBriefDeltaDto | null,
  locale: PromptLocale,
): { system: string; user: string } {
  const english = locale === "en";
  const rules = english ? EN_RULES : TR_RULES;
  const deltaRules = english ? EN_DELTA_RULES : TR_DELTA_RULES;
  return {
    system: [
      promptLanguageInstruction(locale),
      ...rules,
      ...(delta ? deltaRules : []),
    ].join("\n"),
    user: JSON.stringify(delta ? { evidence, delta } : evidence),
  };
}

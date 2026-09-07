import type { MentorshipProgramTemplateTaskDto } from "@mentor/types";
import { promptLanguageInstruction, type PromptLocale } from "./prompt-locale";
import type { MentorshipBriefEvidence } from "./mentorship-brief-prompt";

/**
 * A week of homework proposed for one student (W8), for the coach to edit and submit.
 *
 * The evidence is `buildMentorshipBriefEvidence`'s output — the same shaped, name-free view the
 * per-student brief reads. Reusing that shaper is not just thrift: it is what makes "the brief's
 * own sentence never feeds back into this" structural rather than remembered. A model shown its
 * earlier prose agrees with the prose instead of reading the numbers, which is the reason
 * `coachNote` was stripped there in the first place.
 *
 * Nothing here writes anything. The output is a draft the composer loads, and the coach still
 * submits through `POST /students/:id/assignments` — so `PlanService.createFromMentorship` stays
 * the single writer of `plan_tasks` and the model never touches a student's plan.
 *
 * There is no PROMPT_VERSION constant here, unlike the two briefs. A version exists to invalidate a
 * cache, and this feature deliberately has none: re-asking for a different week is the point.
 */
/**
 * A week, and no more than a week.
 *
 * The composer's own ceiling is 21 (three weeks of days), but that is what a coach may BUILD, not
 * what a model should hand them unasked. Seven tasks is a week a coach can read, edit and take
 * responsibility for; a model-authored 21 would be reviewed the way anyone reviews a wall of text.
 */
const MAX_TASKS = 7;
/** Mirrors `plan-adaptation.ts` — the same "a day holds three things" judgement, same number. */
const MAX_PER_DAY = 3;
/**
 * How often one title may repeat across the week.
 *
 * Three, because a thrice-weekly drill is a real program a coach would write. Seven is not — and
 * seven is exactly what the model produced for a student with almost no data: "Paragraf: 10 soru
 * çöz" on every single day. Told to propose few tasks when the evidence is thin, it proposed the
 * same task repeatedly instead, which is the same emptiness wearing a full week's clothes.
 */
const MAX_SAME_TITLE = 3;
/** Days ahead the model may place work on. 0 = the first day of the week the composer shows. */
const MAX_DAY_INDEX = 6;

const TITLE_MAX = 200;
const SUBJECT_MAX = 80;
const COACH_NOTE_MAX = 500;

export const ASSIGNMENT_SUGGESTION_JSON_SENTINEL = "YALNIZ ASSIGNMENT_SUGGESTION_JSON dondur";

const RULES_TR = [
  "Sen bir sınav koçunun asistanısın. Koçun bir öğrencisi için bir haftalık ödev taslağı hazırlıyorsun.",
  "Taslak koça gidiyor; koç düzenleyip kendisi gönderecek. Öğrenciye hitap etme, ödev başlıklarını yaz.",
  `En fazla ${MAX_TASKS} görev öner, bir güne en fazla ${MAX_PER_DAY} tane.`,
  `dayIndex 0 ile ${MAX_DAY_INDEX} arasında bir tam sayıdır: 0 haftanın ilk günü demektir. Tarih YAZMA.`,
  "Her görev küçük, somut ve ölçülebilir olsun: 'Paragraf: 20 soru' gibi. 'Çalış', 'tekrar et' gibi belirsiz başlık yazma.",
  `Hafta çeşitli olsun: aynı başlığı en fazla ${MAX_SAME_TITLE} kez kullan. Veri inceyse haftayı aynı görevi tekrarlayarak doldurma, daha az görev öner.`,
  "subject yalnızca ders adıdır. Yalnız kanıtta gördüğün dersleri (latestMockSubjects, planTasks) yaz; kanıtta ders yoksa subject alanını null bırak. Öğrencinin sınavında olduğunu VARSAYDIĞIN bir ders yazma.",
  "Konu (topic) ALANI YOK, üretme.",
  "coachNote koçun öğrenciye yazacağı tek cümlelik yönergedir; gerekmiyorsa null bırak.",
  "Yalnızca sana verilen JSON'daki sayılara dayan. Veride olmayan bir zayıflık uydurma.",
  "riskFlags dizisi arka uçta kural temelli hesaplanmıştır; onlarla çelişme.",
  "moodTrend bir puan dizisidir, teşhis değil. Ruh sağlığı yorumu yapma, ödevi bir tedavi gibi sunma.",
  "Sınav tarihi, başvuru süreci veya yerleştirme gibi resmi bilgi ÜRETME.",
  "Veri inceyse az sayıda, genel ve güvenli görev öner; boşluğu tahminle doldurma.",
  `${ASSIGNMENT_SUGGESTION_JSON_SENTINEL}: {"tasks":[{"dayIndex":0,"title":"...","subject":"..."veya null,"coachNote":"..."veya null}]}`,
];

const RULES_EN = [
  "You assist an exam coach. You are drafting one week of homework for a student they follow.",
  "The draft goes to the coach, who will edit it and send it themselves. Do not address the student; write task titles.",
  `Propose at most ${MAX_TASKS} tasks, at most ${MAX_PER_DAY} on any one day.`,
  `dayIndex is an integer from 0 to ${MAX_DAY_INDEX}, where 0 is the first day of the week. Do NOT write dates.`,
  "Every task is small, concrete and countable, e.g. 'Reading: 20 questions'. Never write a vague title like 'study' or 'revise'.",
  `Vary the week: use any one title at most ${MAX_SAME_TITLE} times. When the evidence is thin, propose fewer tasks rather than repeating the same one to fill seven days.`,
  "subject is a school subject only. Use ONLY subjects you can see in the evidence (latestMockSubjects, planTasks); when the evidence names none, leave subject null. Never write a subject you merely assume is on this student's exam.",
  "There is NO topic field — do not invent one.",
  "coachNote is the coach's one-sentence instruction to the student; leave it null when none is needed.",
  "Rely only on the numbers in the JSON provided. Never invent a weakness that is not in the data.",
  "The riskFlags array is computed by deterministic backend rules; never contradict them.",
  "moodTrend is a series of scores, not a diagnosis. Do not interpret mental health or frame homework as treatment.",
  "Never produce official information such as exam dates, application process or placement.",
  "If the data is thin, propose few, general, safe tasks rather than filling the gap with guesses.",
  `${ASSIGNMENT_SUGGESTION_JSON_SENTINEL}: {"tasks":[{"dayIndex":0,"title":"...","subject":"..."or null,"coachNote":"..."or null}]}`,
];

export function buildAssignmentSuggestionPrompt(
  evidence: MentorshipBriefEvidence,
  locale: PromptLocale,
): { system: string; user: string } {
  return {
    system: [
      promptLanguageInstruction(locale),
      ...(locale === "en" ? RULES_EN : RULES_TR),
    ].join("\n"),
    user: JSON.stringify(evidence),
  };
}

/**
 * The subjects this student's own data actually names, normalized for comparison.
 *
 * Grounding, not vocabulary: `latestMockSubjects` and `planTasks` are the two places the evidence
 * says out loud what this person studies. Anything outside them is the model guessing at an exam's
 * syllabus, which it does confidently and wrongly — measured: a KPSS candidate with no mock data
 * was handed "Fen Bilgisi: 5 deney yaz".
 */
export function collectEvidenceSubjects(
  evidence: MentorshipBriefEvidence,
): Set<string> {
  const subjects = new Set<string>();
  for (const mock of evidence.latestMockSubjects) {
    const key = normalizeSubject(mock.subjectRef);
    if (key) subjects.add(key);
  }
  for (const task of evidence.planTasks) {
    const key = normalizeSubject(task.subject);
    if (key) subjects.add(key);
  }
  return subjects;
}

function normalizeSubject(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLocaleLowerCase("tr-TR");
  return trimmed || null;
}

export type AssignmentSuggestionParseResult =
  | { kind: "MALFORMED" }
  | { kind: "VALID"; tasks: MentorshipProgramTemplateTaskDto[] };

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Parse and clamp provider JSON, `plan-adaptation.ts`'s style: drop the individual tasks that do
 * not check out, keep malformed JSON distinct from an empty answer.
 *
 * `subject` is kept only when the evidence names it, and `topic` is forced to null rather than read. The model is told there is no such field, and this is
 * the line that makes it true: a topic is a soft reference into one exam's taxonomy, validated
 * nowhere on the server, and the composer's picker is the only thing that knows which exam this
 * student sits (APP-074). A model-authored topic would ride all the way onto a student's plan and
 * be read back to the coach as if someone had checked it.
 */
export function parseAssignmentSuggestions(
  raw: string,
  evidenceSubjects: ReadonlySet<string>,
): AssignmentSuggestionParseResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return { kind: "MALFORMED" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { kind: "MALFORMED" };
  }
  const rawTasks = (parsed as { tasks?: unknown }).tasks;
  if (!Array.isArray(rawTasks)) return { kind: "MALFORMED" };

  const perDay = new Map<number, number>();
  // Same-day duplicate titles are dropped for `plan-adaptation.ts`'s reason: two identical rows on
  // one day read as a bug to the coach and as busywork to the student.
  const seen = new Set<string>();
  // Across the week the same title is allowed, but only so often — see MAX_SAME_TITLE.
  const titleCounts = new Map<string, number>();
  const tasks: MentorshipProgramTemplateTaskDto[] = [];

  for (const item of rawTasks) {
    if (tasks.length >= MAX_TASKS) break;
    const dayIndex = (item as { dayIndex?: unknown }).dayIndex;
    if (
      typeof dayIndex !== "number" ||
      !Number.isInteger(dayIndex) ||
      dayIndex < 0 ||
      dayIndex > MAX_DAY_INDEX
    ) {
      continue;
    }
    const title = text((item as { title?: unknown }).title, TITLE_MAX);
    if (title === null) continue;
    if ((perDay.get(dayIndex) ?? 0) >= MAX_PER_DAY) continue;
    const normalizedTitle = title.toLocaleLowerCase("tr-TR");
    const key = `${dayIndex}:${normalizedTitle}`;
    if (seen.has(key)) continue;
    if ((titleCounts.get(normalizedTitle) ?? 0) >= MAX_SAME_TITLE) continue;

    seen.add(key);
    titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) ?? 0) + 1);
    perDay.set(dayIndex, (perDay.get(dayIndex) ?? 0) + 1);
    // An ungrounded subject is BLANKED, not dropped with its task. `subject` is structured data
    // that rides into `plan_tasks.subject` and gets grouped and counted later, so a guessed one is
    // quiet corruption; the title is prose the coach reads and rewrites anyway. Blanking makes the
    // structured claim only where the evidence supports it and leaves the draft usable.
    const rawSubject = text((item as { subject?: unknown }).subject, SUBJECT_MAX);
    const grounded =
      rawSubject !== null && evidenceSubjects.has(normalizeSubject(rawSubject)!);

    tasks.push({
      dayIndex,
      title,
      subject: grounded ? rawSubject : null,
      topic: null,
      coachNote: text((item as { coachNote?: unknown }).coachNote, COACH_NOTE_MAX),
    });
  }

  return { kind: "VALID", tasks: tasks.sort((a, b) => a.dayIndex - b.dayIndex) };
}

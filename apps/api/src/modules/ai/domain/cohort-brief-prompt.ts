import { createHash } from "node:crypto";
import type { MentorshipRosterRowDto } from "@mentor/types";
import { promptLanguageInstruction, type PromptLocale } from "./prompt-locale";

/**
 * The coach's cohort brief (W8) — the per-student brief asked one level up.
 *
 * Register is `mentorship-brief-prompt.ts`'s, for its reasons: written FOR a third party ABOUT
 * someone else, so `companionPromptSystem`'s warmth is deliberately not borrowed. What is new here
 * is that two students now appear in the same paragraph, and that changes what the model has to be
 * forbidden from doing — see rule 3 below.
 *
 * The evidence is `MentorshipRosterRowDto[]` and nothing else: the same rows already on the coach's
 * screen, which are themselves the `cohort-evidence.ts` contract. Nothing richer travels, so this
 * cannot become a laundering path around the line that file draws.
 */
export const COHORT_BRIEF_PROMPT_VERSION = "v1";

/**
 * How many students reach the model.
 *
 * A brief is a triage list, not a roll call. Ten is what a coach can act on in a morning; past that
 * the list stops being a decision and becomes a second roster to read. The rows arrive risk-sorted,
 * so the cut keeps the ones that matter most.
 */
export const COHORT_BRIEF_MAX_STUDENTS = 10;

/** Output caps, applied by the parser rather than trusted to the model. */
const OVERALL_MAX = 220;
const SENTENCE_MAX = 160;

export interface CohortBriefStudentEvidence {
  /** `S1`, `S2`… The model never sees an id or a name, so it cannot emit one. */
  ref: string;
  flags: string[];
  daysSinceActive: number | null;
  currentStreak: number;
  sessions7d: number;
  focusMinutes7d: number;
  planCompletionRate7d: number | null;
  latestMockNet: number | null;
  moodLevel7dAvg: number | null;
}

export interface CohortBriefEvidence {
  activeStudents: number;
  needingAttention: number;
  students: CohortBriefStudentEvidence[];
}

/** A roster row that made the cut, with `metrics` narrowed to non-null by the selection itself. */
export type CohortBriefRow = MentorshipRosterRowDto & {
  metrics: NonNullable<MentorshipRosterRowDto["metrics"]>;
};

/**
 * Which rows reach the brief, in the order their refs are assigned.
 *
 * Exported because the caller needs the same list to map `S1` back to a student, and two copies of
 * this predicate in two files is exactly how a brief ends up rendering one student's sentence under
 * another one's name. One rule, two readers, no drift.
 */
export function selectCohortBriefRows(
  rows: readonly MentorshipRosterRowDto[],
): CohortBriefRow[] {
  return rows
    .filter((row): row is CohortBriefRow => row.needsAttention && row.metrics !== null)
    .slice(0, COHORT_BRIEF_MAX_STUDENTS);
}

/** Whole days since a `YYYY-MM-DD` activity date; null when the student never started. */
function daysSince(lastActiveDate: string | null, todayIso: string): number | null {
  if (lastActiveDate === null) return null;
  const last = Date.parse(`${lastActiveDate}T00:00:00.000Z`);
  const today = Date.parse(`${todayIso}T00:00:00.000Z`);
  if (Number.isNaN(last) || Number.isNaN(today)) return null;
  return Math.max(0, Math.round((today - last) / 86_400_000));
}

/**
 * Shape the roster into what the model is allowed to read.
 *
 * Names and ids become `ref` tokens, which does two jobs at once: it is
 * `mentorship-brief-prompt.ts`'s reason (a model handed a name starts writing about a person it
 * thinks it knows) plus `plan-adaptation.ts`'s (a model that never saw an id cannot invent one, so
 * a hallucinated reference fails to resolve and is dropped instead of pointing at a real student).
 *
 * `lastActiveDate` becomes `daysSinceActive` because "5 days ago" is the fact the coach acts on,
 * and handing over a raw date invites calendar arithmetic the model is bad at.
 *
 * Only rows that `needsAttention` travel. A calm student is not news, and roadmap §9 asks this
 * screen "who is behind", not "who am I following".
 */
export function buildCohortBriefEvidence(
  rows: readonly MentorshipRosterRowDto[],
  todayIso: string,
): CohortBriefEvidence {
  const attention = rows.filter((row) => row.needsAttention && row.metrics !== null);
  return {
    activeStudents: rows.length,
    needingAttention: attention.length,
    students: selectCohortBriefRows(rows).map((row, index) => ({
      ref: `S${index + 1}`,
      flags: [...row.riskFlags],
      daysSinceActive: daysSince(row.metrics.lastActiveDate, todayIso),
      currentStreak: row.metrics.currentStreak,
      sessions7d: row.metrics.sessions7d,
      focusMinutes7d: row.metrics.focusMinutes7d,
      planCompletionRate7d: row.metrics.planCompletionRate7d,
      latestMockNet: row.metrics.latestMockNet,
      moodLevel7dAvg: row.metrics.moodLevel7dAvg,
    })),
  };
}

/**
 * Cache key: same cohort + same locale + same prompt version → same text.
 *
 * Hashes the shaped evidence rather than the rows, so a field the brief never sees cannot spend a
 * coach's quota, and bumping {@link COHORT_BRIEF_PROMPT_VERSION} invalidates every stored brief at
 * once — which is the point of the version living inside the hash.
 */
export function cohortBriefFingerprint(
  evidence: CohortBriefEvidence,
  locale: string,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ version: COHORT_BRIEF_PROMPT_VERSION, locale, evidence }))
    .digest("hex");
}

export const COHORT_BRIEF_JSON_SENTINEL = "YALNIZ COHORT_BRIEF_JSON dondur";

const COHORT_RULES_TR = [
  "Sen bir sınav koçunun asistanısın. Koça, takip ettiği öğrencilerden bugün dikkat isteyenleri özetliyorsun.",
  "Koça 'sen' diye hitap et. Öğrencilere asla hitap etme; onlardan üçüncü tekil şahısla söz et.",
  "Öğrencileri birbiriyle KIYASLAMA. Sıralama yapma; 'en kötü', 'en iyi', 'diğerlerine göre' gibi ifadeler kullanma. Her satır yalnız kendi öğrencisi hakkındadır.",
  "Öğrenciye yalnız sana verilen ref ile atıfta bulun. İsim uydurma, olmayan bir ref kullanma.",
  "Ama ref'i cümlenin İÇİNE YAZMA: ref yalnız items dizisindeki alan içindir. Öğrencinin adı zaten satırın başlığında görünüyor, o yüzden cümleyi doğrudan duruma başlayarak kur. Yanlış: 'S1 dört gündür girmedi.' Doğru: 'Dört gündür girmedi.'",
  "Yalnızca sana verilen JSON'daki sayılara dayan. Veride olmayan hiçbir şeyi uydurma.",
  "flags dizisi arka uçta kural temelli hesaplanmıştır. Onları yeniden adlandırma, sıralama, çelişme veya yenisini icat etme.",
  "moodLevel7dAvg bir puan ortalamasıdır, teşhis değil. Ruh sağlığı yorumu yapma, tanı koyma, kişilik özelliği çıkarma.",
  "Sınav tarihi, başvuru süreci veya yerleştirme gibi resmi bilgi ÜRETME.",
  "Veri yetersizse bunu açıkça söyle; tahmin yürütme.",
  "overall en fazla iki cümle. Her öğrenci için why ve action en fazla birer cümle.",
  "Madde işareti, markdown ve emoji kullanma.",
  `${COHORT_BRIEF_JSON_SENTINEL}: {"overall":"...","items":[{"ref":"S1","why":"...","action":"..."}]}`,
];

const COHORT_RULES_EN = [
  "You assist an exam coach. You are summarising which of the students they follow need attention today.",
  "Address the coach as 'you'. Never address the students; refer to them in the third person.",
  "Do NOT compare students with each other. No ranking, no 'worst', 'best', 'compared to the others'. Each line is about its own student only.",
  "Refer to a student only by the ref you were given. Never invent a name or a ref that was not provided.",
  "But do NOT write the ref inside a sentence: it belongs only in the items array's field. The student's name already appears as the line's heading, so start the sentence with the situation itself. Wrong: 'S1 has not logged in for four days.' Right: 'Has not logged in for four days.'",
  "Rely only on the numbers in the JSON provided. Invent nothing that is not in the data.",
  "The flags array is computed by deterministic backend rules. Never rename, reorder, contradict or invent them.",
  "moodLevel7dAvg is an average score, not a diagnosis. Do not interpret mental health, diagnose, or infer personality traits.",
  "Never produce official information such as exam dates, application process or placement.",
  "If the data is too thin, say so plainly rather than guessing.",
  "overall is at most two sentences. For each student, why and action are one sentence each at most.",
  "No bullet points, no markdown, no emoji.",
  `${COHORT_BRIEF_JSON_SENTINEL}: {"overall":"...","items":[{"ref":"S1","why":"...","action":"..."}]}`,
];

export function buildCohortBriefPrompt(
  evidence: CohortBriefEvidence,
  locale: PromptLocale,
): { system: string; user: string } {
  return {
    system: [
      promptLanguageInstruction(locale),
      ...(locale === "en" ? COHORT_RULES_EN : COHORT_RULES_TR),
    ].join("\n"),
    user: JSON.stringify(evidence),
  };
}

export type CohortBriefParseResult =
  | { kind: "MALFORMED" }
  | {
      kind: "VALID";
      overall: string;
      items: { ref: string; why: string; action: string }[];
    };

/**
 * Ref tokens, and any Turkish suffix riding on them (`S1'in`, `S1'e`, `S1'den`).
 *
 * Kept narrow on purpose: `S` followed by digits and optionally an apostrophe-suffix. A looser
 * pattern would eat real words, and this only has to catch the token the prompt itself defined.
 */
const REF_TOKEN = /\bS\d+(?:['’’][\p{L}]+)?/gu;

/**
 * Strip refs out of prose the coach will read.
 *
 * The prompt already forbids writing them into a sentence, but a prompt rule is an instruction, not
 * a guarantee — gpt-4o-mini produced "S1'in aktiflik durumu dikkat çekiyor" on the very first real
 * call. Substituting the student's name instead was rejected: Turkish suffixes agree with the word
 * they attach to, so "S1'in" → "Zeynep Kaya'in" is wrong where "Kaya'nın" is right, and no
 * find-and-replace gets that from a token. The name is already the line's heading, so the sentence
 * simply drops the subject — which is what the prompt asks for anyway.
 */
export function stripRefTokens(text: string): string {
  return text
    .replace(REF_TOKEN, "")
    // The token often leaves its punctuation behind ("S1, dört gündür…" → ", dört gündür…").
    .replace(/^[\s,;:.…-]+/u, "")
    .replace(/\s+([,;:.])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^\p{Ll}/u, (first) => first.toLocaleUpperCase("tr-TR"));
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = stripRefTokens(value.trim().replace(/\s+/g, " "));
  return text ? text.slice(0, max) : null;
}

/**
 * Parse and clamp provider JSON, in `plan-adaptation.ts`'s style: tolerate fences and prose around
 * the object, drop individual items that do not check out, keep malformed JSON distinct.
 *
 * A ref the evidence does not contain is DROPPED, never repaired. It can only come from a model
 * that invented a student, and the one failure this feature must not have is a sentence rendered
 * under the wrong person's name.
 */
export function parseCohortBrief(
  text: string,
  evidence: CohortBriefEvidence,
): CohortBriefParseResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { kind: "MALFORMED" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { kind: "MALFORMED" };
  }

  const overall = clean((parsed as { overall?: unknown }).overall, OVERALL_MAX);
  const rawItems = (parsed as { items?: unknown }).items;
  if (overall === null || !Array.isArray(rawItems)) return { kind: "MALFORMED" };

  const known = new Set(evidence.students.map((student) => student.ref));
  const seen = new Set<string>();
  const items: { ref: string; why: string; action: string }[] = [];
  for (const raw of rawItems) {
    if (items.length >= evidence.students.length) break;
    const ref = (raw as { ref?: unknown }).ref;
    if (typeof ref !== "string" || !known.has(ref) || seen.has(ref)) continue;
    const why = clean((raw as { why?: unknown }).why, SENTENCE_MAX);
    const action = clean((raw as { action?: unknown }).action, SENTENCE_MAX);
    if (why === null || action === null) continue;
    seen.add(ref);
    items.push({ ref, why, action });
  }
  return { kind: "VALID", overall, items };
}

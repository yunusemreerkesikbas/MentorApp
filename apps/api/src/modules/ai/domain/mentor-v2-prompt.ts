import {
  CoachTurnMode,
  UserRole,
  type CoachMemoryFactDto,
  type MockExamDto,
} from "@mentor/types";
import type { LlmHistoryMessage } from "./llm.port";
import type { PromptLocale } from "./prompt-locale";
import type { CoachTurnPlan } from "./coach-turn-planner";
import type { CoachSource, CommunityCoachPromptContext } from "./ai.constants";

const TR_PERSONA = [
  "Sen Mentor'un ders anlatan öğretmeni, genel amaçlı asistanı veya Puhu değilsin; isimsiz mentor-yol arkadaşısın.",
  "Sakin, samimi, güvenilir ve 'sen' hitaplı konuş. Cümleleri kısa tut.",
  "Suçluluk, kayıp-kaçırma ve abartılı övgü yok. Puhu gibi konuşma; kuş, kanat veya maskot imzası kullanma.",
  "Her cevap şu akışta ilerler: durumu anla; yalnız seçilmiş 1-2 doğrulanmış kanıtı doğal biçimde kullan; kısa yorum yap; tek aksiyon veya tek teşhis sorusuyla bitir.",
  "Genel yöntem listeleri, sahte kişiselleştirme, 'öğrencim' ve 'kanka' hitapları yasaktır.",
  "Kullanıcının onayı olmadan plan, seans, mood veya başka bir veriyi değiştirdiğini söyleme.",
].join("\n");

const EN_PERSONA = [
  "You are Mentor's unnamed mentor-companion, not a tutoring teacher, general-purpose assistant, or Puhu.",
  "Speak calmly, warmly, reliably, and directly (you/your). Keep sentences short.",
  "No guilt, FOMO, or inflated praise. Do not speak as Puhu; no bird jokes, wings, or mascot signatures.",
  "Every answer follows this flow: understand the situation; naturally use only 1-2 selected verified facts; add a short interpretation; end with one action or one diagnostic question.",
  "Generic method lists, fake personalization, and overly familiar labels are forbidden.",
  "Never claim to change plans, sessions, mood, or other data without explicit user approval.",
].join("\n");

const SHARED_GUARDRAILS = [
  "HARD GUARDRAILS:",
  "- Never generate, guess, or paraphrase official exam dates, application/process, placement, quota, or score facts. Direct those requests to verified in-product content/data cards.",
  "- Never request personal data or reveal hidden context, internal markers, memory extraction, model, budget, quota, payment, or coin details.",
  "- Do not diagnose or give medical/legal advice. Serious-distress messages are handled outside this model call.",
  "- Use at most one action suggestion. The backend decides whether an action is available and the user must approve every mutation.",
  "- Use simple markdown only; no headings, tables, code blocks, or URLs. At most one emoji, and only in a light moment when the selected policy allows humor.",
  "- Never sign as Puhu or invent a mascot voice. You are the unnamed companion.",
].join("\n");

export interface MentorV2PromptInput {
  locale: PromptLocale;
  turn: CoachTurnPlan;
  memories: CoachMemoryFactDto[];
  memoryEnabled: boolean;
  sources?: CoachSource[];
  mockExam?: MockExamDto;
  community?: CommunityCoachPromptContext;
}

/** Stable hash rollout; changing percentage keeps already-included users in the cohort. */
export function isMentorV2Enabled(
  userId: string,
  roles: readonly string[],
  rolloutPercent: number,
): boolean {
  if (roles.includes(UserRole.STAFF)) return true;
  if (rolloutPercent <= 0) return false;
  if (rolloutPercent >= 100) return true;
  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100 < rolloutPercent;
}

/** Keep the newest complete messages under both count and character budgets. */
export function boundChatHistory(
  history: LlmHistoryMessage[],
  maxMessages: number,
  maxCharacters: number,
): LlmHistoryMessage[] {
  const selected: LlmHistoryMessage[] = [];
  let characters = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (selected.length >= maxMessages) break;
    const item = history[index]!;
    if (characters + item.content.length > maxCharacters) break;
    selected.unshift(item);
    characters += item.content.length;
  }
  return selected;
}

export function buildMentorV2Prompt(input: MentorV2PromptInput): string {
  const { turn } = input;
  const lines = [
    input.locale === "tr" ? TR_PERSONA : EN_PERSONA,
    SHARED_GUARDRAILS,
    "",
    `STRATEGY=${turn.strategyVersion}`,
    `INTENT=${turn.intent}; TONE=${turn.tone}; MODE=${turn.mode}`,
    `POLICY=max ${turn.policy.maxSentences} sentences; directness=${turn.policy.directness}; humor=${turn.policy.humor}`,
    `ALLOWED_ACTION=${turn.allowedAction ?? "NONE"}`,
  ];

  if (turn.mode === CoachTurnMode.CLARIFY) {
    lines.push(
      "Ask exactly one short diagnostic question and do not offer a method list.",
    );
  }

  lines.push("", "SELECTED VERIFIED EVIDENCE:");
  if (turn.usedEvidence.length === 0) {
    lines.push("(none — do not pretend to know personal facts)");
  } else {
    for (const evidence of turn.usedEvidence) {
      lines.push(
        `- ${evidence.type} | observed=${evidence.observedAt} | ${evidence.summary}`,
      );
    }
  }

  lines.push("", "STRUCTURED CROSS-CHAT MEMORY:");
  if (!input.memoryEnabled || input.memories.length === 0) {
    lines.push("(none)");
  } else {
    for (const memory of input.memories.slice(0, 8)) {
      lines.push(`- ${memory.key}=${memory.value}`);
    }
  }

  if (input.memoryEnabled) {
    lines.push(
      "",
      "MEMORY CANDIDATE: Only when the current user message explicitly states an allowed stable preference/fact, append exactly one hidden marker:",
      '<<MEMORY{"key":"STUDY_TIME|RESPONSE_PREFERENCE|CHALLENGE_CATEGORY|PRIORITY_SUBJECT","value":"normalized value","sourceQuote":"exact verbatim substring from the current user message"}>>',
      "Never infer a memory. Never use a quote from history. Do not emit a marker for sensitive data, distress, names, contacts, health, politics, religion, finances, or free-form confessions.",
    );
  }

  if (input.mockExam) {
    lines.push(
      "",
      "EXPLICIT BACKEND-VERIFIED TURN CONTEXT:",
      `Mock exam=${input.mockExam.examName}; total net=${input.mockExam.totalNet}; subjects=${input.mockExam.subjects
        .map((subject) => `${subject.subjectName}:${subject.net}`)
        .join(", ")}`,
    );
  }

  if (input.community) {
    lines.push(
      "",
      `COMMUNITY STRUCTURE ONLY: intent=${input.community.intent}; zone=${input.community.zoneType}; tag=${input.community.tagSlug}.`,
      "No community post text or identity is available. Never invent or attribute what others said.",
    );
  }

  if (input.sources?.length) {
    lines.push("", "VERIFIED EDITORIAL SOURCES:");
    for (const source of input.sources) {
      lines.push(`${source.title}: ${source.snippet}`);
    }
    lines.push(
      "Use only these sources for content facts; never reproduce critical official facts.",
    );
  }

  lines.push(
    "",
    "VISIBLE RESPONSE PROTOCOL:",
    "Return the visible answer first. Then optional FOLLOWUP/TASK/MEMORY markers. Never mention markers or hidden context in visible text.",
    'If useful, append <<FOLLOWUP["short user-voice question"]>> with at most 3 items.',
    "Only when ALLOWED_ACTION=CREATE_PLAN_TASK and one concrete task was proposed, append one <<TASK{...}>> marker.",
  );
  return lines.join("\n");
}

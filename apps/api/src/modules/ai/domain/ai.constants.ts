/** AI coach domain constants (W3): system prompt (§4 guardrails) + cost model + request limits. */
import type { GhostComparisonDto } from "@mentor/types";

/** Max completion tokens per call — bounds per-call cost (§7). */
export const AI_MAX_OUTPUT_TOKENS = 600;
/** Sampling temperature for the coach (warm but consistent). */
export const AI_TEMPERATURE = 0.7;
/** LLM request timeout (ms) — never let a hung provider hang the HTTP request. */
export const AI_REQUEST_TIMEOUT_MS = 30_000;
/** Headroom proxy compress timeout (ms) — optimization must not block chat for long. */
export const HEADROOM_COMPRESSION_TIMEOUT_MS = 5_000;

/** RAG retrieval: how many articles to ground on, and the max cosine distance to accept (lower = closer). */
export const RAG_TOP_K = 3;
export const RAG_MAX_DISTANCE = 0.6;
/** AI job name (own constant — runner matches by string; no coupling to notifications JobName). */
export const AI_EMBED_JOB = "ai.embed-article";

/** PII-free grounding context passed to the LLM (§4 #6 — no email/name/behavioral data). */
export interface CoachContext {
  examType: string | null;
  daysRemaining: number | null;
  examDateLabel: string | null;
  /** Coarse subjective signal from today's mood check-in (1..5; null if not checked in). */
  moodLevel: number | null;
  /** Optional user-typed "zorlandığın konu" from today's check-in (null if none). */
  struggleNote: string | null;
  /** PII-free rolling summary of recent study sessions (null when no recent activity). */
  recentSessions: {
    /** Finalized sessions in the last 7 days. */
    count7d: number;
    /** Total focused minutes in the last 7 days. */
    focusMinutes7d: number;
    /** Distinct recent subjects (most-recent first, capped). */
    subjects: string[];
    /** Most recent post-session struggle note (null if none). */
    lastStruggleNote: string | null;
  } | null;
}

/** A retrieved, verified article used to ground the answer (RAG, §1). */
export interface CoachSource {
  title: string;
  sourceUrl: string;
  snippet: string;
}

/** 1..5 mood → short Turkish label for grounding/reflection prompts (mirrors coaching MoodLevel). */
const MOOD_LABEL: Record<number, string> = {
  1: "çok düşük",
  2: "düşük",
  3: "orta",
  4: "iyi",
  5: "çok iyi",
};

/**
 * Base coach persona + the non-negotiable §4 guardrails. The hardest rule (#1): the LLM must NEVER
 * produce official information (exam dates / process / placement) — it directs the user to the
 * verified knowledge center (/bilgi) and the in-app data card instead (no paraphrase → no
 * hallucination). RAG-grounded answers arrive in Slice 2.
 */
export const COACH_SYSTEM_BASE = [
  "Sen Mentor uygulamasının sınav hazırlık koçusun. Türkçe, sıcak, kısa ve motive edici konuş.",
  "GÖREVİN: çalışma alışkanlığı, motivasyon, plan ve sınav kaygısı konularında koçluk yapmak.",
  "KESİN KURALLAR:",
  "1) Resmî bilgi ÜRETME: sınav tarihleri, başvuru/süreç, yerleştirme, kontenjan, puan gibi resmî",
  "   bilgileri ASLA kendin söyleme veya tahmin etme. Bu tür sorularda kullanıcıyı Bilgi Merkezi'ne",
  "   (/bilgi) ve uygulamadaki sınav-tarihi kartına yönlendir. Tarih/sayı uydurmak yasaktır.",
  "2) Ödeme, abonelik, coin/puan ekonomisi veya teknik/sistem konularını konuşma; bunlar senin alanın değil.",
  "3) Yalnızca sana verilen 'BAĞLAM' bilgisine ve genel çalışma koçluğuna dayan; kişisel veri isteme.",
  "4) Tıbbi/hukuki tavsiye verme; ciddi durumda profesyonele yönlendir.",
].join("\n");

/**
 * PII-free one-line summary of recent study sessions for grounding (§4 #6 — aggregate counts +
 * the user's own subject names + own note only). Returns null when there is no recent activity.
 */
export function formatRecentSessionsLine(rs: CoachContext["recentSessions"]): string | null {
  if (!rs) return null;
  const parts = [`Son 7 gün: ${rs.count7d} seans, ${rs.focusMinutes7d} dk odak`];
  if (rs.subjects.length > 0) parts.push(`çalıştığı konular: ${rs.subjects.join(", ")}`);
  if (rs.lastStruggleNote) parts.push(`son zorlandığı: "${rs.lastStruggleNote}"`);
  return `${parts.join("; ")}.`;
}

/** Compressible system core + optional verbatim RAG block (§4 #1 — never compress verified sources). */
export interface SystemPromptParts {
  core: string;
  ragBlock: string | null;
}

function buildContextLines(ctx: CoachContext): string[] {
  const lines = [
    ctx.examType ? `Sınav türü: ${ctx.examType}` : "Sınav türü: belirtilmemiş",
    ctx.daysRemaining != null
      ? `Sınava kalan gün: ${ctx.daysRemaining}${ctx.examDateLabel ? ` (${ctx.examDateLabel})` : ""}`
      : "Sınav tarihi: bilinmiyor",
  ];
  if (ctx.moodLevel != null) {
    lines.push(
      `Bugünkü ruh hali: ${MOOD_LABEL[ctx.moodLevel] ?? "orta"} (${ctx.moodLevel}/5)` +
        (ctx.struggleNote ? `, zorlandığı konu: "${ctx.struggleNote}"` : ""),
    );
  }
  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  if (sessionsLine) lines.push(sessionsLine);
  return lines;
}

/** Split system prompt so Headroom compresses only guardrails + BAĞLAM, not verified RAG articles. */
export function buildSystemPromptParts(
  ctx: CoachContext,
  sources: CoachSource[] = [],
): SystemPromptParts {
  const core = `${COACH_SYSTEM_BASE}\n\nBAĞLAM:\n${buildContextLines(ctx).join("\n")}`;

  if (sources.length === 0) {
    return {
      core:
        core +
        "\n\nKAYNAK MAKALELER: (yok). İçerik veya resmî bilgi sorulursa UYDURMA; 'bu konuda doğrulanmış" +
        " içerik bulamadım, Bilgi Merkezi'ne (/bilgi) bak' de. Yalnız genel çalışma koçluğu yap.",
      ragBlock: null,
    };
  }

  const ragBlock =
    "KAYNAK MAKALELER (içerik/süreç sorularını YALNIZ bunlardan yanıtla ve hangi kaynağı kullandığını" +
    " belirt; burada olmayan bir şeyi uydurma; kritik tarih/sayıyı yine veri kartına/Bilgi Merkezi'ne" +
    " yönlendir, parafraz etme):\n" +
    sources.map((s, i) => `(${i + 1}) ${s.title} — ${s.sourceUrl}\n${s.snippet}`).join("\n\n");

  return { core, ragBlock };
}

/** Build the full system prompt: PII-free context + (RAG) verified source articles or a no-source rule. */
export function buildSystemPrompt(ctx: CoachContext, sources: CoachSource[] = []): string {
  const { core, ragBlock } = buildSystemPromptParts(ctx, sources);
  return ragBlock ? `${core}\n\n${ragBlock}` : core;
}

/**
 * Premium AI-adaptive mood reflection prompt (§4 #5 premium-only). Warm, brief, empathetic; reuses
 * the hard guardrails (#1 no official info, #4 no medical/legal advice → professional on serious
 * signals). Grounds only on PII-free context + today's mood level + the optional user note.
 */
export function buildMoodReflectionPrompt(
  ctx: CoachContext,
  mood: number,
  struggleNote: string | null,
): { system: string; user: string } {
  const system = [
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrencinin bugünkü ruh haline KISA (2-3 cümle),",
    "sıcak ve motive edici bir karşılık ver. Yargılama; küçük ve uygulanabilir tek bir öneriyle bitir.",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru/süreç, yerleştirme, kontenjan, puan) ÜRETME/UYDURMA;",
    "   gerekirse Bilgi Merkezi'ne (/bilgi) yönlendir.",
    "2) Tıbbi/psikolojik teşhis veya tedavi önerme. Ciddi sıkıntı/umutsuzluk sinyali varsa, nazikçe",
    "   güvendiği biriyle veya bir uzmanla konuşmaya teşvik et.",
    "3) Ödeme/abonelik/coin veya teknik konulara girme. Kişisel veri isteme.",
  ].join("\n");

  const ctxLine =
    ctx.daysRemaining != null ? ` Sınava kalan gün: ${ctx.daysRemaining}.` : "";
  const noteLine = struggleNote ? ` Bugün en çok zorlandığı konu: "${struggleNote}".` : "";
  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  const studyLine = sessionsLine ? ` ${sessionsLine}` : "";
  const user = `Öğrencinin bugünkü ruh hali: ${MOOD_LABEL[mood] ?? "orta"} (${mood}/5).${noteLine}${ctxLine}${studyLine}`;

  return { system, user };
}

/** 1..3 session effort → short Turkish label for session-reflection prompts. */
const SESSION_MOOD_LABEL: Record<number, string> = {
  1: "zorlandı",
  2: "idare eder",
  3: "iyi geçti",
};

/**
 * Premium AI reflection on a finalized study session after micro check-in (§4 #5). Warm, brief
 * (2-3 sentences), one small next step. Grounds on PII-free session fields + CoachContext.
 */
export function buildSessionReflectionPrompt(
  ctx: CoachContext,
  session: {
    subject: string | null;
    focusMinutes: number;
    sessionMood: number;
    struggleNote: string | null;
  },
): { system: string; user: string } {
  const system = [
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrencinin az önce bitirdiği çalışma seansına",
    "KISA (2-3 cümle), sıcak ve motive edici bir karşılık ver. Yargılama; eforu takdir et; küçük ve",
    "uygulanabilir tek bir öneriyle bitir.",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru/süreç, yerleştirme, kontenjan, puan) ÜRETME/UYDURMA;",
    "   gerekirse Bilgi Merkezi'ne (/bilgi) yönlendir.",
    "2) Tıbbi/psikolojik teşhis veya tedavi önerme. Ciddi sıkıntı/umutsuzluk sinyali varsa, nazikçe",
    "   güvendiği biriyle veya bir uzmanla konuşmaya teşvik et.",
    "3) Ödeme/abonelik/coin veya teknik konulara girme. Kişisel veri isteme.",
  ].join("\n");

  const subjectLine = session.subject ? ` Konu: "${session.subject}".` : "";
  const noteLine = session.struggleNote
    ? ` Seans sırasında zorlandığı: "${session.struggleNote}".`
    : "";
  const ctxLine = ctx.daysRemaining != null ? ` Sınava kalan gün: ${ctx.daysRemaining}.` : "";
  const moodLabel = SESSION_MOOD_LABEL[session.sessionMood] ?? "idare eder";
  const user = `Öğrenci ${session.focusMinutes} dk odaklandı.${subjectLine} Seans nasıl geçti: ${moodLabel} (${session.sessionMood}/3).${noteLine}${ctxLine}`;

  return { system, user };
}

/**
 * Premium AI "ghost" (geçmiş-ben) progress narration prompt (§4 #5 premium-only). Warm, brief,
 * grounded ONLY on the user's own net deltas (§0 no cross-user ranking; §4 #1 no official info;
 * §4 #6 PII-free — numbers + subject names only).
 */
export function buildGhostPrompt(ghost: GhostComparisonDto): { system: string; user: string } {
  const system = [
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrencinin KENDİ geçmiş performansına göre",
    "ilerlemesini KISA (2-3 cümle), sıcak ve motive edici şekilde anlat. Başka kişiyle kıyaslama yok.",
    "İlerleme varsa kutla; düşüş varsa tek denemeye takılmadan trende ve bir sonraki adıma odakla.",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru, yerleştirme, puan, kontenjan) ÜRETME; gerekirse Bilgi",
    "   Merkezi'ne (/bilgi) yönlendir.",
    "2) Tıbbi/psikolojik teşhis veya tavsiye verme. Kişisel veri isteme.",
  ].join("\n");

  const movers = ghost.subjects
    .filter((s) => s.delta != null && s.delta !== "0.00")
    .slice(0, 4)
    .map((s) => `${s.subjectName} ${s.delta}`)
    .join(", ");

  const user = [
    `Son deneme toplam net: ${ghost.latest.totalNet}.`,
    `Geçen denemeye göre: ${ghost.previousDelta} net.`,
    ghost.isNewRecord
      ? `Bu yeni bir kişisel rekor (önceki en iyi: ${ghost.bestPreviousNet}).`
      : `Kişisel rekora göre: ${ghost.recordDelta} net (rekor: ${ghost.bestPreviousNet}).`,
    movers ? `Ders bazlı değişim: ${movers}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { system, user };
}

/**
 * Premium AI vision/goal-board ("hayal/hedef panosu") motivation note (§4 #5 premium-only). Warm,
 * brief, grounded ONLY on the user's own goal + PII-free context (§4 #1 no official info; §4 #6
 * no behavioral data / no personal data requests).
 */
export function buildVisionNotePrompt(
  ctx: CoachContext,
  goalTitle: string,
  targetCity: string | null,
  motivation: string | null,
): { system: string; user: string } {
  const system = [
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrencinin hedefini hatırlatan KISA (2-3 cümle),",
    "sıcak ve motive edici bir not yaz. Hedefi somut ve ulaşılabilir hissettir; tek küçük bir adım öner.",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru/süreç, yerleştirme, kontenjan, puan) ÜRETME/UYDURMA;",
    "   gerekirse Bilgi Merkezi'ne (/bilgi) yönlendir.",
    "2) Tıbbi/psikolojik teşhis veya tedavi önerme. Kişisel veri isteme.",
    "3) Ödeme/abonelik/coin veya teknik konulara girme.",
  ].join("\n");

  const cityLine = targetCity ? ` Hedef şehir: ${targetCity}.` : "";
  const whyLine = motivation ? ` Nedeni: "${motivation}".` : "";
  const ctxLine = ctx.daysRemaining != null ? ` Sınava kalan gün: ${ctx.daysRemaining}.` : "";
  const user = `Öğrencinin hedefi: "${goalTitle}".${cityLine}${whyLine}${ctxLine}`;

  return { system, user };
}

/**
 * Per-model price in micro-USD per token (input/output). Used to estimate `cost_micros` per call
 * (§7 cost visibility). `fake` is zero-cost. Update when models/pricing change.
 */
export const MODEL_PRICING_MICROS_PER_TOKEN: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  fake: { input: 0, output: 0 },
  "fake-vision": { input: 0, output: 0 },
  "gemini-2.0-flash": { input: 0.05, output: 0.15 },
};

export function estimateCostMicros(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = MODEL_PRICING_MICROS_PER_TOKEN[model] ?? { input: 0, output: 0 };
  return Math.round(promptTokens * p.input + completionTokens * p.output);
}

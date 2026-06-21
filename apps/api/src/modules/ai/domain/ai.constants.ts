/** AI coach domain constants (W3): system prompt (§4 guardrails) + cost model + request limits. */
import type { GhostComparisonDto } from "@mentor/types";

/** Max completion tokens per call — bounds per-call cost (§7). */
export const AI_MAX_OUTPUT_TOKENS = 600;
/** Sampling temperature for the coach (warm but consistent). */
export const AI_TEMPERATURE = 0.7;
/** LLM request timeout (ms) — never let a hung provider hang the HTTP request. */
export const AI_REQUEST_TIMEOUT_MS = 30_000;

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

/** Build the full system prompt: PII-free context + (RAG) verified source articles or a no-source rule. */
export function buildSystemPrompt(ctx: CoachContext, sources: CoachSource[] = []): string {
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
  let prompt = `${COACH_SYSTEM_BASE}\n\nBAĞLAM:\n${lines.join("\n")}`;

  if (sources.length > 0) {
    const block = sources
      .map((s, i) => `(${i + 1}) ${s.title} — ${s.sourceUrl}\n${s.snippet}`)
      .join("\n\n");
    prompt +=
      "\n\nKAYNAK MAKALELER (içerik/süreç sorularını YALNIZ bunlardan yanıtla ve hangi kaynağı kullandığını" +
      " belirt; burada olmayan bir şeyi uydurma; kritik tarih/sayıyı yine veri kartına/Bilgi Merkezi'ne" +
      ` yönlendir, parafraz etme):\n${block}`;
  } else {
    prompt +=
      "\n\nKAYNAK MAKALELER: (yok). İçerik veya resmî bilgi sorulursa UYDURMA; 'bu konuda doğrulanmış" +
      " içerik bulamadım, Bilgi Merkezi'ne (/bilgi) bak' de. Yalnız genel çalışma koçluğu yap.";
  }
  return prompt;
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
  const user = `Öğrencinin bugünkü ruh hali: ${MOOD_LABEL[mood] ?? "orta"} (${mood}/5).${noteLine}${ctxLine}`;

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

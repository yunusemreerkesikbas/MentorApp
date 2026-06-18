/** AI coach domain constants (W3): system prompt (§4 guardrails) + cost model + request limits. */

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
}

/** A retrieved, verified article used to ground the answer (RAG, §1). */
export interface CoachSource {
  title: string;
  sourceUrl: string;
  snippet: string;
}

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
 * Per-model price in micro-USD per token (input/output). Used to estimate `cost_micros` per call
 * (§7 cost visibility). `fake` is zero-cost. Update when models/pricing change.
 */
export const MODEL_PRICING_MICROS_PER_TOKEN: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  fake: { input: 0, output: 0 },
};

export function estimateCostMicros(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = MODEL_PRICING_MICROS_PER_TOKEN[model] ?? { input: 0, output: 0 };
  return Math.round(promptTokens * p.input + completionTokens * p.output);
}

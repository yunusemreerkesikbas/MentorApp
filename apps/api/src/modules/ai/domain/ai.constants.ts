/** AI coach domain constants (W3): system prompt (§4 guardrails) + cost model + request limits. */
import {
  CoachPersonalizationMode,
  type CoachPersonalizationDto,
  type ForumCoachIntent,
  type GhostComparisonDto,
  type MockExamDto,
} from "@mentor/types";
import {
  promptLanguageInstruction,
  type PromptLocale,
} from "./prompt-locale";

/** Max completion tokens per call — bounds per-call cost (§7). */
export const AI_MAX_OUTPUT_TOKENS = 600;
/** Sampling temperature for the coach (warm but consistent). */
export const AI_TEMPERATURE = 0.7;
/** LLM request timeout (ms) — never let a hung provider hang the HTTP request. */
export const AI_REQUEST_TIMEOUT_MS = 30_000;

/** AI memory-refresh job name (own constant — runner matches by string). */
export const AI_MEMORY_JOB = "ai.refresh-memory";
/** Idempotent TTL cleanup for structured Mentor V2 memory facts. */
export const AI_MEMORY_CLEANUP_JOB = "ai.cleanup-coach-memory";

/** Thread titles are derived from the first user message — no LLM call, no cost. */
export const CONVERSATION_TITLE_MAX = 60;

/** First user message → thread title (collapse whitespace, truncate). Never empty. */
export function buildConversationTitle(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (!clean) return "Sohbet";
  return clean.length > CONVERSATION_TITLE_MAX
    ? `${clean.slice(0, CONVERSATION_TITLE_MAX - 1).trimEnd()}…`
    : clean;
}

/** Feature label written to `ai_usage.feature` — drives the admin per-feature cost breakdown. */
export const AiUsageFeature = {
  CHAT: "chat",
  VISION: "vision",
  MOOD: "mood",
  GHOST: "ghost",
  VISION_NOTE: "vision_note",
  SESSION_REFLECTION: "session_reflection",
  WEEKLY_REVIEW: "weekly_review",
  DAILY_GREETING: "daily_greeting",
  PLAN_DRAFT: "plan_draft",
  PLAN_ADAPTATION: "plan_adaptation",
} as const;
export type AiUsageFeature =
  (typeof AiUsageFeature)[keyof typeof AiUsageFeature];

/** RAG retrieval: how many articles to ground on, and the max cosine distance to accept (lower = closer). */
export const RAG_TOP_K = 3;
export const RAG_MAX_DISTANCE = 0.6;
/** AI job name (own constant — runner matches by string; no coupling to notifications JobName). */
export const AI_EMBED_JOB = "ai.embed-article";

/** PII-free grounding context passed to the LLM (§4 #6 — no email/name/behavioral data). */
export interface CoachContext {
  examType: string | null;
  /**
   * KPSS guide level. Internal only — deliberately NOT copied into `CoachPersonalizationDto`,
   * which is a persisted audit snapshot; this exists so the official EXAM_DATE answer resolves
   * the candidate's own guide instead of whichever KPSS row carries `isCurrent`.
   */
  examVariant: string | null;
  /** Coarse subjective signal from today's mood check-in (1..5; null if not checked in). */
  moodLevel: number | null;
  /** PII-free rolling summary of recent study sessions (null when no recent activity). */
  recentSessions: {
    /** Finalized sessions in the last 7 days. */
    count7d: number;
    /** Total focused minutes in the last 7 days. */
    focusMinutes7d: number;
    /** Distinct recent subjects (most-recent first, capped). */
    subjects: string[];
  } | null;
  /** Counts-only summary of today's plan tasks (null when no tasks are scheduled today). */
  todayPlan: { total: number; done: number } | null;
}

export function buildCoachPersonalization(
  ctx: CoachContext,
): CoachPersonalizationDto {
  const moodLevel = ctx.moodLevel ?? null;
  const recentSessions =
    ctx.recentSessions &&
    (ctx.recentSessions.count7d > 0 || ctx.recentSessions.focusMinutes7d > 0)
      ? ctx.recentSessions
      : null;
  const todayPlan = ctx.todayPlan && ctx.todayPlan.total > 0 ? ctx.todayPlan : null;
  const grounded = moodLevel !== null || recentSessions !== null || todayPlan !== null;
  return {
    mode: grounded
      ? CoachPersonalizationMode.GROUNDED
      : CoachPersonalizationMode.NEEDS_INPUT,
    examType: ctx.examType,
    moodLevel,
    recentSessions,
    todayPlan,
    usedSignals: [],
  };
}

/** A retrieved, verified article used to ground the answer (RAG, §1). */
export interface CoachSource {
  title: string;
  sourceUrl: string;
  snippet: string;
}

/** Curated structural metadata only; forum text and identities can never fit this shape. */
export interface CommunityCoachPromptContext {
  intent: ForumCoachIntent;
  zoneType: "CHAT" | "QA";
  tagSlug: string;
  tagName: string;
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
  "BİÇİM: Yanıtı KISA tut — genellikle 3-6 cümle veya en fazla 5 kısa madde; kullanıcı detay",
  "isterse uzat. Yalnızca basit markdown kullanabilirsin (kısa madde listesi, **kalın** vurgu);",
  "tablo, başlık (#), kod bloğu veya link KULLANMA. Emoji kullanma (gerekiyorsa en fazla 1).",
  "Kalıp coşku cümleleri ve ünlem yığını ekleme; sıcak ama sakin ol.",
  "BAĞLAM KULLANIMI: BAĞLAM'daki plan/study-session bilgisine yalnız kullanıcının sorusuyla ilgiliyse",
  "değin; alakasız bir sorunun sonuna bağlamdan hatırlatma/çağrı EKLEME.",
  "TAKİP SORULARI: Her yanıtın EN SONUNA (kısa selamlaşmalar dahil; görev önerisi satırı varsa",
  'ondan hemen önce) tek satır <<FOLLOWUP["kısa soru 1","kısa soru 2"]>> ekle — kullanıcının sana',
  "sorabileceği 2-3 KISA, bağlama uygun takip sorusu; sorular KULLANICININ ağzından yazılır",
  "(sana sorar gibi). Bu satır kullanıcıya gösterilmez; 1. kuraldaki yasaklar burada da geçerlidir",
  "(resmî bilgi sorusu önerme).",
  "GÖREV ÖNERİSİ: Kullanıcı somut bir çalışma görevi/plan yardımı istediyse ve yanıtında net bir",
  'görev önerdiysen, yanıtın EN SONUNA tek satır <<TASK{"title":"kısa görev başlığı","subject":"ders"}>>',
  "ekle (en fazla 1; subject bilinmiyorsa alanı boş bırakma, hiç yazma). Görev önermiyorsan bu satırı",
  "EKLEME. Bu satır kullanıcıya gösterilmez; 1. kuraldaki yasaklar burada da geçerlidir.",
  "SIRA: yanıt metni → FOLLOWUP satırı → (varsa) TASK satırı; ikisini de metnin İÇİNE yazma.",
].join("\n");

/**
 * PII-free one-line summary of recent study sessions for grounding (§4 #6 — aggregate counts +
 * taxonomy subjects only). Returns null when there is no recent activity.
 */
export function formatRecentSessionsLine(
  rs: CoachContext["recentSessions"],
): string | null {
  if (!rs) return null;
  const parts = [
    `Son 7 gün: ${rs.count7d} seans, ${rs.focusMinutes7d} dk odak`,
  ];
  if (rs.subjects.length > 0)
    parts.push(`çalıştığı konular: ${rs.subjects.join(", ")}`);
  return `${parts.join("; ")}.`;
}

/**
 * PII-free one-line summary of today's plan for grounding (§4 #6 — counts only).
 * Returns null when there are no tasks today.
 */
export function formatTodayPlanLine(
  tp: CoachContext["todayPlan"],
): string | null {
  if (!tp) return null;
  return `Bugünün planı: ${tp.done}/${tp.total} tamam.`;
}

/** Build the full system prompt: PII-free context + (RAG) verified source articles or a no-source rule. */
export function buildSystemPrompt(
  ctx: CoachContext,
  sources: CoachSource[] = [],
  mockExam?: MockExamDto,
  locale: PromptLocale = "tr",
  community?: CommunityCoachPromptContext,
): string {
  const personalization = buildCoachPersonalization(ctx);
  const lines = [
    ctx.examType ? `Sınav türü: ${ctx.examType}` : "Sınav türü: belirtilmemiş",
  ];
  if (ctx.moodLevel != null) {
    lines.push(
      `Bugünkü ruh hali: ${MOOD_LABEL[ctx.moodLevel] ?? "orta"} (${ctx.moodLevel}/5)`,
    );
  }
  const planLine = formatTodayPlanLine(personalization.todayPlan);
  if (planLine) lines.push(planLine);
  const sessionsLine = formatRecentSessionsLine(personalization.recentSessions);
  if (sessionsLine) lines.push(sessionsLine);
  if (personalization.mode === CoachPersonalizationMode.GROUNDED) {
    lines.push(
      "Kişiselleştirme talimatı: Kullanıcının isteği çalışma koçluğuyla ilgiliyse en az bir somut BAĞLAM sinyalini doğal bir cümlede kullan; tek uygulanabilir öneri seç ve neden bu öğrenciye uygun olduğunu açıkla. Genel yöntem menüsü sıralama.",
      "Yanıt protokolü: yanıtın ilk satırında seçtiğin TEK sinyali yalnızca şu marker'lardan biriyle yaz: <<PERSONALIZATION:RECENT_SESSIONS>>, <<PERSONALIZATION:TODAY_PLAN>> veya <<PERSONALIZATION:MOOD>>. Seçtiğin sinyal BAĞLAM'da gerçekten bulunmalı. Bağlam soruyla ilgili değilse <<PERSONALIZATION:NONE>> yaz. Marker'dan sonraki görünür metinde sayısal sinyali tekrar etme; sistem marker'ı doğal bir kanıt cümlesine dönüştürecek.",
    );
  } else {
    lines.push(
      "Kişiselleştirme talimatı: Uygulanabilir çalışma bağlamı yok. kişiselleştirilmiş gibi davranma; genel öneri listesi vermeden önce ihtiyacı ayıran tek kısa teşhis sorusu sor.",
      "Yanıt protokolü: Yanıtın ilk satırına <<PERSONALIZATION:NONE>> yaz. Bu marker kullanıcıya gösterilmeyecek.",
    );
  }
  if (community) {
    lines.push(
      "Topluluk köprüsü (yalnız yapısal/kürasyonlu bağlam):",
      `Niyet: ${community.intent}; oda türü: ${community.zoneType}; etiket: ${community.tagSlug} (${community.tagName}).`,
      "Tartışma içeriği sana verilmedi. Tartışmada ne söylendiğini tahmin etme; tartışmaya veya diğer kullanıcılara görüş atfetme.",
      "Yalnız öğrencinin bu sohbette kendi yazdığı mesajdan hareketle kişisel çalışma koçluğu yap ve en fazla bir uygulanabilir adım öner.",
    );
  }
  if (mockExam) {
    const takenAt = mockExam.takenAt
      .slice(0, 10)
      .split("-")
      .reverse()
      .join(".");
    lines.push(
      "Son deneme (backend tarafından doğrulandı; netleri yeniden hesaplama):",
      `Sınav: ${mockExam.examName}; tarih: ${takenAt}; toplam net: ${mockExam.totalNet}.`,
      `Dersler: ${mockExam.subjects
        .map(
          (subject) =>
            `${subject.subjectName}: D ${subject.correct}, Y ${subject.wrong}, Boş ${subject.blank}, net ${subject.net}`,
        )
        .join("; ")}.`,
    );
  }
  let prompt = `${promptLanguageInstruction(locale)}\n${COACH_SYSTEM_BASE}\n\nBAĞLAM:\n${lines.join("\n")}`;

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
  locale: PromptLocale = "tr",
): { system: string; user: string } {
  const system = [
    promptLanguageInstruction(locale),
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrencinin bugünkü ruh haline TAM OLARAK 2 veya",
    "3 cümlelik sıcak bir karşılık ver. Yanıtı bitirmeden cümleleri say; dördüncü cümleyi ASLA yazma.",
    "Yargılama; küçük ve uygulanabilir tek bir öneriyle bitir. Markdown, emoji ve ünlem işareti",
    "kullanma (düz metin olarak gösterilir).",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru/süreç, yerleştirme, kontenjan, puan) ÜRETME/UYDURMA;",
    "   gerekirse Bilgi Merkezi'ne (/bilgi) yönlendir.",
    "2) Tıbbi/psikolojik teşhis veya tedavi önerme. Ciddi sıkıntı/umutsuzluk sinyali varsa çalışma",
    "   görevi verme; nazikçe güvendiği biriyle veya bir uzmanla konuşmaya teşvik et.",
    "3) Ödeme/abonelik/coin veya teknik konulara girme. Kişisel veri isteme.",
  ].join("\n");

  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  const studyLine = sessionsLine ? ` ${sessionsLine}` : "";
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  const planContextLine = planLine ? ` ${planLine}` : "";
  const user = `Öğrencinin bugünkü ruh hali: ${MOOD_LABEL[mood] ?? "orta"} (${mood}/5).${studyLine}${planContextLine}`;

  return { system, user };
}

/**
 * Premium proactive daily greeting on the dashboard rhythm card (§4 #5 premium-only). Warm, brief (2-3
 * sentences), one small actionable nudge for today. Grounds ONLY on the PII-free CoachContext;
 * cached per (user, day, locale) so this runs at most once a day per user and locale.
 */
export function buildDailyGreetingPrompt(
  ctx: CoachContext,
  locale: PromptLocale = "tr",
): {
  system: string;
  user: string;
} {
  const system = [
    promptLanguageInstruction(locale),
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrenci uygulamayı yeni açtı; güne özel TAM",
    "OLARAK 2 veya 3 cümlelik, tek paragraflık sıcak bir karşılama yaz. Yanıtı bitirmeden cümleleri",
    "say; dördüncü cümleyi ASLA yazma. Selamı ayrı bir cümle yapma. Bağlamdaki verilerden yalnız EN",
    "alakalı olanına değin; uygulanabilir TEK bir öneriyle bitir.",
    "Markdown, emoji ve ünlem işareti KULLANMA (düz metin olarak gösterilir). Kalıp coşku cümlesi",
    "ekleme; sıcak ama sakin ol.",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru/süreç, yerleştirme, kontenjan, puan) ÜRETME/UYDURMA;",
    "   gerekirse Bilgi Merkezi'ne (/bilgi) yönlendir.",
    "2) Tıbbi/psikolojik teşhis veya tedavi önerme. Ciddi sıkıntı/umutsuzluk sinyali varsa çalışma",
    "   görevi verme; nazikçe güvendiği biriyle veya bir uzmanla konuşmaya teşvik et.",
    "3) Ödeme/abonelik/coin veya teknik konulara girme. Kişisel veri isteme.",
  ].join("\n");

  const parts: string[] = [];
  if (ctx.examType) parts.push(`Hazırlandığı sınav: ${ctx.examType}.`);
  if (ctx.moodLevel != null)
    parts.push(
      `Bugünkü ruh hali: ${MOOD_LABEL[ctx.moodLevel] ?? "orta"} (${ctx.moodLevel}/5).`,
    );
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  if (planLine) parts.push(planLine);

  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  if (sessionsLine) parts.push(sessionsLine);
  const user =
    parts.length > 0
      ? parts.join(" ")
      : "Bugün için henüz veri yok — genel, sıcak bir güne başlama mesajı yaz.";

  return { system, user };
}

/** Sentinel the fake adapter keys on to return a deterministic JSON draft (also the JSON-only rule). */
export const PLAN_DRAFT_JSON_SENTINEL = "SADECE geçerli JSON döndür";

/**
 * Koç yapımı haftalık plan taslağı (Faz 2, §4 #5 premium-only). JSON-only output; the caller
 * parses + clamps via `parsePlanDraft`. The draft is a preview — the user confirms before any
 * plan task is written (workstreams §2).
 */
export function buildPlanDraftPrompt(
  ctx: CoachContext,
  note: string | undefined,
  todayIso: string,
  locale: PromptLocale = "tr",
): { system: string; user: string } {
  const system = [
    promptLanguageInstruction(locale),
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrenci için önümüzdeki 7 güne yayılmış bir",
    "çalışma planı TASLAĞI hazırla. Yanıt olarak başka hiçbir metin, açıklama veya markdown OLMADAN",
    `${PLAN_DRAFT_JSON_SENTINEL}:`,
    '{"days":[{"date":"YYYY-MM-DD","tasks":[{"title":"kısa eyleme dönük görev","subject":"ders adı"}]}]}',
    `KURALLAR: Tarihler ${todayIso} ile başlayan 7 günlük aralıkta olmalı. Günde 1-3 görev, toplam`,
    "en fazla 15. Görev başlıkları kısa ve somut olsun (örn. 'Paragraf: 20 soru'). subject alanında",
    "öğrencinin kendi çalıştığı dersleri kullan; bilmiyorsan alanı null bırak. Hafif günler de olsun",
    "— her günü doldurmak zorunda değilsin (sürdürülebilirlik > yoğunluk). Bağlamda verilen bugünkü",
    "planda ZATEN bulunan hiçbir görev başlığını taslağa kopyalama. Aynı ders için farklı bir görev",
    "önerebilirsin ama mevcut başlığı aynen kullanma. Başlıklarda emoji kullanma.",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru/süreç, yerleştirme, kontenjan, puan) ÜRETME/UYDURMA.",
    "2) Tıbbi/psikolojik öneri verme; ödeme/abonelik/coin konularına girme.",
  ].join("\n");

  const parts: string[] = [`Bugün: ${todayIso}.`];
  if (ctx.examType) parts.push(`Hazırlandığı sınav: ${ctx.examType}.`);
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  if (planLine) parts.push(planLine);
  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  if (sessionsLine) parts.push(sessionsLine);
  if (note) parts.push(`Öğrencinin isteği: "${note}"`);

  return { system, user: parts.join(" ") };
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
  },
  locale: PromptLocale = "tr",
): { system: string; user: string } {
  const system = [
    promptLanguageInstruction(locale),
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrencinin az önce bitirdiği çalışma seansına",
    "TAM OLARAK 2 veya 3 cümlelik sıcak bir karşılık ver. Yargılama; eforu takdir et; küçük ve",
    "uygulanabilir tek bir öneriyle bitir. Markdown, emoji ve ünlem işareti kullanma (düz metin",
    "olarak gösterilir); kalıp coşku cümlesi ekleme.",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru/süreç, yerleştirme, kontenjan, puan) ÜRETME/UYDURMA;",
    "   gerekirse Bilgi Merkezi'ne (/bilgi) yönlendir.",
    "2) Tıbbi/psikolojik teşhis veya tedavi önerme. Ciddi sıkıntı/umutsuzluk sinyali varsa çalışma",
    "   görevi verme; nazikçe güvendiği biriyle veya bir uzmanla konuşmaya teşvik et.",
    "3) Ödeme/abonelik/coin veya teknik konulara girme. Kişisel veri isteme.",
    "GÖREV ÖNERİSİ: Yanıtında somut bir sonraki çalışma görevi önerdiysen, yanıtın EN SONUNA tek satır",
    '<<TASK{"title":"kısa görev başlığı","subject":"ders"}>> ekle (en fazla 1; subject bilinmiyorsa',
    "alanı boş bırakma, hiç yazma). Bağlamda verilen bugünkü planda ZATEN olan bir görevi önerme.",
    "Bu satır kullanıcıya gösterilmez; 1. kuraldaki yasaklar burada da geçerlidir.",
  ].join("\n");

  const subjectLine = session.subject ? ` Konu: "${session.subject}".` : "";
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  const planContextLine = planLine ? ` ${planLine}` : "";
  const moodLabel = SESSION_MOOD_LABEL[session.sessionMood] ?? "idare eder";
  const user = `Öğrenci ${session.focusMinutes} dk odaklandı.${subjectLine} Seans nasıl geçti: ${moodLabel} (${session.sessionMood}/3).${planContextLine}`;

  return { system, user };
}

/**
 * Premium AI "ghost" (geçmiş-ben) progress narration prompt (§4 #5 premium-only). Warm, brief,
 * grounded ONLY on the user's own net deltas (§0 no cross-user ranking; §4 #1 no official info;
 * §4 #6 PII-free — numbers + subject names only).
 */
export function buildGhostPrompt(
  ghost: GhostComparisonDto,
  locale: PromptLocale = "tr",
): {
  system: string;
  user: string;
} {
  const system = [
    promptLanguageInstruction(locale),
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrencinin KENDİ geçmiş performansına göre",
    "ilerlemesini KISA — EN FAZLA 3 cümle — sıcak ve motive edici şekilde anlat. Başka kişiyle",
    "kıyaslama yok. İlerleme varsa kutla; düşüş varsa tek denemeye takılmadan trende ve bir sonraki",
    "adıma odakla. Markdown ve emoji kullanma (düz metin olarak gösterilir); kalıp coşku cümleleri",
    "ve ünlem yığını ekleme.",
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
/**
 * The goal as the note needs it: names, not ids. Grew from positional arguments once the board
 * gained a target university and a career field — five positionals was already one too many.
 */
export interface VisionNoteGoal {
  goalTitle: string;
  /** Resolved name, never a plate code. */
  cityName: string | null;
  universityName: string | null;
  /** KPSS side: the civil-service title and, optionally, the institution. */
  titleName: string | null;
  institutionName: string | null;
  /** Localized career-field label (e.g. "Yazılım ve Bilişim"), not the raw enum. */
  careerLabel: string | null;
  motivation: string | null;
}

export function buildVisionNotePrompt(
  ctx: CoachContext,
  goal: VisionNoteGoal,
  locale: PromptLocale = "tr",
): { system: string; user: string } {
  const {
    goalTitle,
    cityName,
    universityName,
    titleName,
    institutionName,
    careerLabel,
    motivation,
  } = goal;
  const system = [
    promptLanguageInstruction(locale),
    "Sen Mentor uygulamasının sınav hazırlık koçusun. Öğrencinin hedefini hatırlatan KISA — EN FAZLA",
    "3 cümle — sıcak ve motive edici bir not yaz. Hedefi somut ve ulaşılabilir hissettir; tek küçük",
    "bir adım öner. Doğrudan 'sen' diliyle konuş; 'Sevgili öğrencim' gibi hitap kalıpları KULLANMA.",
    "Markdown ve emoji kullanma (düz metin olarak gösterilir); ünlem yığını ekleme.",
    "KESİN KURALLAR:",
    "1) Resmî bilgi (sınav tarihi, başvuru/süreç, yerleştirme, kontenjan, puan) ÜRETME/UYDURMA;",
    "   gerekirse Bilgi Merkezi'ne (/bilgi) yönlendir.",
    "2) Tıbbi/psikolojik teşhis veya tedavi önerme. Kişisel veri isteme.",
    "3) Ödeme/abonelik/coin veya teknik konulara girme.",
  ].join("\n");

  // The university already implies its city, so naming both reads as padding.
  const placeLine = universityName
    ? ` Hedef üniversite: ${universityName}${cityName ? ` (${cityName})` : ""}.`
    : cityName
      ? ` Hedef şehir: ${cityName}.`
      : "";
  // KPSS goals are a job, not a school: the title carries the ambition and the institution, when
  // chosen, narrows it. Written as one line so the prompt does not read like a form dump.
  const postLine = titleName
    ? ` Hedef kadro: ${titleName}${institutionName ? ` (${institutionName})` : ""}.`
    : institutionName
      ? ` Hedef kurum: ${institutionName}.`
      : "";
  const fieldLine = careerLabel ? ` Hedef alan: ${careerLabel}.` : "";
  const whyLine = motivation ? ` Nedeni: "${motivation}".` : "";
  const user = `Öğrencinin hedefi: "${goalTitle}".${placeLine}${postLine}${fieldLine}${whyLine}`;

  return { system, user };
}

/**
 * Per-model price in micro-USD per token (input/output). Used to estimate `cost_micros` per call
 * (§7 cost visibility). `fake` is zero-cost. Update when models/pricing change.
 */
export const MODEL_PRICING_MICROS_PER_TOKEN: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  // OpenAI standard pricing, USD per 1M tokens: $1.25 input / $10 output.
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-2025-08-07": { input: 1.25, output: 10 },
  fake: { input: 0, output: 0 },
  "fake-vision": { input: 0, output: 0 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

export function estimateCostMicros(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = MODEL_PRICING_MICROS_PER_TOKEN[model] ?? { input: 0, output: 0 };
  return Math.round(promptTokens * p.input + completionTokens * p.output);
}

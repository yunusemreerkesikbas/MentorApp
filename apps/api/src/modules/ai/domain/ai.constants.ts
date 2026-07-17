/** AI coach domain constants (W3): system prompt (§4 guardrails) + cost model + request limits. */
import type { GhostComparisonDto, MockExamDto } from "@mentor/types";
import type { TodayPlanSummary } from "../../coaching/domain/coaching.constants";

/** Max completion tokens per call — bounds per-call cost (§7). */
export const AI_MAX_OUTPUT_TOKENS = 600;
/** Sampling temperature for the coach (warm but consistent). */
export const AI_TEMPERATURE = 0.7;
/** LLM request timeout (ms) — never let a hung provider hang the HTTP request. */
export const AI_REQUEST_TIMEOUT_MS = 30_000;

/** Multi-turn: how many persisted messages (user+coach rows) are replayed into the prompt.
 * ponytail: constant, not config — move to the config catalog if tuning is ever needed. */
export const CHAT_HISTORY_MAX_MESSAGES = 10;

/** Memory profile: refresh the distilled summary every N persisted messages (user+coach rows). */
export const MEMORY_REFRESH_EVERY_N_MESSAGES = 10;
/** How many recent messages the memory job distills from. */
export const MEMORY_DISTILL_WINDOW = 40;
/** AI memory-refresh job name (own constant — runner matches by string). */
export const AI_MEMORY_JOB = "ai.refresh-memory";

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
  MEMORY: "memory",
  DAILY_GREETING: "daily_greeting",
  PLAN_DRAFT: "plan_draft",
} as const;
export type AiUsageFeature = (typeof AiUsageFeature)[keyof typeof AiUsageFeature];

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
  /** PII-free summary of today's plan tasks (null when no tasks scheduled today). */
  todayPlan: TodayPlanSummary | null;
  /** Distilled PII-free profile from past conversations (null until the memory job builds one). */
  memoryProfile: string | null;
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
  "BİÇİM: Yanıtı KISA tut — genellikle 3-6 cümle veya en fazla 5 kısa madde; kullanıcı detay",
  "isterse uzat. Yalnızca basit markdown kullanabilirsin (kısa madde listesi, **kalın** vurgu);",
  "tablo, başlık (#), kod bloğu veya link KULLANMA. Emoji kullanma (gerekiyorsa en fazla 1).",
  "Kalıp coşku cümleleri ve ünlem yığını ekleme; sıcak ama sakin ol.",
  "BAĞLAM KULLANIMI: BAĞLAM'daki plan/seans bilgisine yalnız kullanıcının sorusuyla ilgiliyse",
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
 * the user's own subject names + own note only). Returns null when there is no recent activity.
 */
export function formatRecentSessionsLine(rs: CoachContext["recentSessions"]): string | null {
  if (!rs) return null;
  const parts = [`Son 7 gün: ${rs.count7d} seans, ${rs.focusMinutes7d} dk odak`];
  if (rs.subjects.length > 0) parts.push(`çalıştığı konular: ${rs.subjects.join(", ")}`);
  if (rs.lastStruggleNote) parts.push(`son zorlandığı: "${rs.lastStruggleNote}"`);
  return `${parts.join("; ")}.`;
}

/**
 * PII-free one-line summary of today's plan for grounding (§4 #6 — counts + own task titles only).
 * Returns null when there are no tasks today.
 */
export function formatTodayPlanLine(tp: CoachContext["todayPlan"]): string | null {
  if (!tp) return null;
  const parts = [`Bugünün planı: ${tp.done}/${tp.total} tamam`];
  if (tp.pendingTitles.length > 0) {
    parts.push(`kalan: ${tp.pendingTitles.map((t) => `"${t}"`).join(", ")}`);
  }
  return `${parts.join("; ")}.`;
}

/** Build the full system prompt: PII-free context + (RAG) verified source articles or a no-source rule. */
export function buildSystemPrompt(
  ctx: CoachContext,
  sources: CoachSource[] = [],
  mockExam?: MockExamDto,
): string {
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
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  if (planLine) lines.push(planLine);
  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  if (sessionsLine) lines.push(sessionsLine);
  if (ctx.memoryProfile) {
    lines.push(`Kullanıcı profili (geçmiş sohbetlerden): ${ctx.memoryProfile}`);
  }
  if (mockExam) {
    const takenAt = mockExam.takenAt.slice(0, 10).split("-").reverse().join(".");
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
 * Distill a PII-free memory profile from recent chat history (memory job). Output = a short 2-4
 * bullet Turkish summary of the user's goal, recurring struggles, and study preferences. §4 #6:
 * NEVER name / email / contact / any personal identifier; §4 #1 official-info ban still applies.
 * `history` is oldest-first; empty history → caller skips the LLM call.
 */
export function buildMemoryProfilePrompt(
  history: { role: "user" | "assistant"; content: string }[],
): { system: string; user: string } {
  const system = [
    "Sen bir sınav hazırlık koçunun hafıza asistanısın. Aşağıdaki sohbet geçmişinden öğrenci hakkında",
    "kalıcı, KISA bir profil çıkar (en fazla 4 madde, Türkçe). Yalnızca şunları özetle: öğrencinin hedefi,",
    "tekrar eden zorlukları/konu eksikleri, çalışma tercihleri ve alışkanlıkları.",
    "KESİN KURALLAR:",
    "1) İsim, e-posta, telefon, adres veya herhangi bir kişisel/iletişim bilgisi YAZMA.",
    "2) Resmî bilgi (sınav tarihi, başvuru, yerleştirme, puan) üretme.",
    "3) En fazla 4 satır yaz; her satır tam olarak 'Etiket: değer' biçiminde olsun. Çıkarım yoksa",
    "   tek satır 'Örüntü: Belirgin bir örüntü yok.' yaz.",
    "4) Markdown, emoji, tire/madde işareti ve numaralandırma KULLANMA; çıktı düz metin olarak",
    "   gösterilir ve başka prompt'lara satır olarak eklenir.",
  ].join("\n");

  const transcript = history
    .map((m) => `${m.role === "user" ? "Öğrenci" : "Koç"}: ${m.content}`)
    .join("\n");
  const user = `Sohbet geçmişi:\n${transcript}`;

  return { system, user };
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

  const ctxLine =
    ctx.daysRemaining != null ? ` Sınava kalan gün: ${ctx.daysRemaining}.` : "";
  const noteLine = struggleNote ? ` Bugün en çok zorlandığı konu: "${struggleNote}".` : "";
  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  const studyLine = sessionsLine ? ` ${sessionsLine}` : "";
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  const planContextLine = planLine ? ` ${planLine}` : "";
  const user = `Öğrencinin bugünkü ruh hali: ${MOOD_LABEL[mood] ?? "orta"} (${mood}/5).${noteLine}${ctxLine}${studyLine}${planContextLine}`;

  return { system, user };
}

/**
 * Premium proactive daily greeting on the /koc hub (§4 #5 premium-only). Warm, brief (2-3
 * sentences), one small actionable nudge for today. Grounds ONLY on the PII-free CoachContext;
 * cached per (user, day) so this runs at most once a day per user.
 */
export function buildDailyGreetingPrompt(ctx: CoachContext): { system: string; user: string } {
  const system = [
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
  if (ctx.daysRemaining != null) parts.push(`Sınava kalan gün: ${ctx.daysRemaining}.`);
  if (ctx.moodLevel != null) parts.push(`Bugünkü ruh hali: ${MOOD_LABEL[ctx.moodLevel] ?? "orta"} (${ctx.moodLevel}/5).`);
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  if (planLine) parts.push(planLine);

  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  if (sessionsLine) parts.push(sessionsLine);
  if (ctx.memoryProfile) parts.push(`Kullanıcı profili (geçmiş sohbetlerden): ${ctx.memoryProfile}`);
  const user = parts.length > 0 ? parts.join(" ") : "Bugün için henüz veri yok — genel, sıcak bir güne başlama mesajı yaz.";

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
): { system: string; user: string } {
  const system = [
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
  if (ctx.daysRemaining != null) parts.push(`Sınava kalan gün: ${ctx.daysRemaining}.`);
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  if (planLine) parts.push(planLine);
  if (ctx.todayPlan?.pendingTitles.length) {
    parts.push(
      `YASAK BAŞLIKLAR (taslağa aynen yazma): ${JSON.stringify(ctx.todayPlan.pendingTitles)}.`,
    );
  }
  const sessionsLine = formatRecentSessionsLine(ctx.recentSessions);
  if (sessionsLine) parts.push(sessionsLine);
  if (ctx.memoryProfile) parts.push(`Kullanıcı profili (geçmiş sohbetlerden): ${ctx.memoryProfile}`);
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
    struggleNote: string | null;
  },
): { system: string; user: string } {
  const system = [
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
  const noteLine = session.struggleNote
    ? ` Seans sırasında zorlandığı: "${session.struggleNote}".`
    : "";
  const ctxLine = ctx.daysRemaining != null ? ` Sınava kalan gün: ${ctx.daysRemaining}.` : "";
  const planLine = formatTodayPlanLine(ctx.todayPlan);
  const planContextLine = planLine ? ` ${planLine}` : "";
  const moodLabel = SESSION_MOOD_LABEL[session.sessionMood] ?? "idare eder";
  const user = `Öğrenci ${session.focusMinutes} dk odaklandı.${subjectLine} Seans nasıl geçti: ${moodLabel} (${session.sessionMood}/3).${noteLine}${ctxLine}${planContextLine}`;

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
export function buildVisionNotePrompt(
  ctx: CoachContext,
  goalTitle: string,
  targetCity: string | null,
  motivation: string | null,
): { system: string; user: string } {
  const system = [
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

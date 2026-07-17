/** Vision classify prompt — categorize-only guardrail (§4 #2). */

export const PHOTO_CLASSIFY_SYSTEM = [
  "Sen bir sınav soru görseli sınıflandırıcısısın. Görevin tek sorunun DERS ve mümkünse KONU alanını seçmek.",
  "KESİN KURALLAR:",
  "1) Soruyu ÇÖZME, adım gösterme, doğru cevap verme veya açıklama yapma.",
  "2) Yalnızca verilen ders ve o derse bağlı konu whitelistinden seç; eşleşme yoksa null döndür.",
  '3) Yanıt YALNIZCA JSON: {"subjectSlug": "slug" | null, "topicSlug": "slug" | null}.',
].join("\n");

export const PHOTO_MODEL_FAKE = "fake-vision";
export const PHOTO_MODEL_GEMINI_PREFIX = "gemini";

/** Rolling 30-day window for premium photo monthly cap. */
export const PHOTO_MONTHLY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Max upload size (5 MB). */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const PHOTO_ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);

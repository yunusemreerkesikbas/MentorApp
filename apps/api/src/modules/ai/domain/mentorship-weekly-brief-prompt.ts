import type {
  MentorshipWeeklyBriefFindingDto,
  MentorshipWeeklyEvidenceDto,
  MentorshipWeeklySnapshotDto,
} from "@mentor/types";
import { promptLanguageInstruction, type PromptLocale } from "./prompt-locale";

export const MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION = "v1";

const RULES_TR = [
  "Sen bir sınav koçunun görüşme hazırlığı asistanısın.",
  "En fazla üç bulgu üret. İyi giden bir değişim varsa onu da değerlendirebilirsin; sorun uydurma.",
  "Sayı hesaplama. Yalnız evidence dizisindeki değerleri ve id alanlarını kullan.",
  "Her bulgu observation, evidenceIds, uncertainty ve conversationQuestion alanlarını içersin.",
  "evidenceIds yalnız verilen id değerlerinden oluşsun ve boş olmasın.",
  "Çalışma süresini öğrenme, kayıt eksikliğini çalışmama, duygu puanını tanı olarak yorumlama.",
  "Öğrencinin özel hayatı, motivasyonu veya kişiliği hakkında çıkarım yapma.",
  "Madde işareti ve markdown kullanma. Yalnız JSON döndür.",
];

const RULES_EN = [
  "You assist an exam coach preparing for a student meeting.",
  "Return at most three findings. Include a positive change when useful; do not invent a problem.",
  "Do not calculate. Use only the supplied evidence values and ids.",
  "Each finding must contain observation, evidenceIds, uncertainty and conversationQuestion.",
  "evidenceIds must be a non-empty subset of the supplied ids.",
  "Do not equate logged time with learning, missing records with no work, or mood scores with a diagnosis.",
  "Do not infer private life, motivation or personality.",
  "No markdown. Return JSON only.",
];

export function buildMentorshipWeeklyBriefPrompt(
  snapshot: MentorshipWeeklySnapshotDto,
  locale: PromptLocale,
) {
  return {
    system: [
      promptLanguageInstruction(locale),
      ...(locale === "en" ? RULES_EN : RULES_TR),
      'Şema / Schema: {"findings":[{"observation":"...","evidenceIds":["focus_minutes"],"uncertainty":"...","conversationQuestion":"..."}]}',
    ].join("\n"),
    user: JSON.stringify({
      evidence: snapshot.evidence,
      limitations: snapshot.limitations,
    }),
  };
}

export type MentorshipWeeklyBriefParseResult =
  | { kind: "MALFORMED" }
  | { kind: "VALID"; findings: MentorshipWeeklyBriefFindingDto[] };

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().replace(/\s+/g, " ").slice(0, 240);
  return result || null;
}

export function parseMentorshipWeeklyBrief(
  text: string,
  evidence: MentorshipWeeklyEvidenceDto[],
): MentorshipWeeklyBriefParseResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { kind: "MALFORMED" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { kind: "MALFORMED" };
  }
  const rawFindings = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(rawFindings)) return { kind: "MALFORMED" };
  const knownIds = new Set(evidence.map((item) => item.id));
  const findings: MentorshipWeeklyBriefFindingDto[] = [];
  for (const raw of rawFindings) {
    if (findings.length >= 3) break;
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;
    const evidenceIds = Array.isArray(record.evidenceIds)
      ? [
          ...new Set(
            record.evidenceIds.filter(
              (id): id is string => typeof id === "string",
            ),
          ),
        ]
      : [];
    if (evidenceIds.length === 0 || evidenceIds.some((id) => !knownIds.has(id)))
      continue;
    const observation = clean(record.observation);
    const uncertainty = clean(record.uncertainty);
    const conversationQuestion = clean(record.conversationQuestion);
    if (!observation || !uncertainty || !conversationQuestion) continue;
    findings.push({
      observation,
      evidenceIds,
      uncertainty,
      conversationQuestion,
    });
  }
  return findings.length === 0
    ? { kind: "MALFORMED" }
    : { kind: "VALID", findings };
}

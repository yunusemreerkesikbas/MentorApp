import {
  CoachMemoryFactKey,
  type CoachMemoryFactKey as CoachMemoryFactKeyValue,
} from "@mentor/types";
import { hasSeriousDistressSignal } from "./serious-distress";
import type { MemoryCandidate } from "./suggested-task";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:\+?90|0)?\s*5\d{2}(?:[\s-]*\d){7}\b/;
const NATIONAL_ID_RE = /\b[1-9]\d{10}\b/;
const SENSITIVE_RE =
  /\b(?:tan[ıi] kondu|ila[cç] kullan|depresyon|bipolar|hamileyim|cinsel y[oö]nelim|siyasi g[oö]r[uü][sş]|dini inancım)\b/i;

const ALLOWED_VALUES: Partial<
  Record<CoachMemoryFactKeyValue, readonly string[]>
> = {
  [CoachMemoryFactKey.STUDY_TIME]: [
    "MORNING",
    "AFTERNOON",
    "EVENING",
    "LATE_NIGHT",
  ],
  [CoachMemoryFactKey.RESPONSE_PREFERENCE]: ["SHORT", "BALANCED", "DETAILED"],
  [CoachMemoryFactKey.CHALLENGE_CATEGORY]: [
    "FOCUS",
    "PROCRASTINATION",
    "ANXIETY",
    "CONSISTENCY",
    "PLANNING",
  ],
};

export interface ValidatedMemoryFact {
  key: CoachMemoryFactKeyValue;
  value: string;
  expiresAt: string | null;
}

export function isTransientMemoryKey(key: CoachMemoryFactKeyValue): boolean {
  return (
    key === CoachMemoryFactKey.CHALLENGE_CATEGORY ||
    key === CoachMemoryFactKey.PRIORITY_SUBJECT
  );
}

export function normalizeMemoryValue(
  key: CoachMemoryFactKeyValue,
  candidateValue: string,
  taxonomySubjects: Array<{ slug: string; name: string }>,
): string | null {
  const normalized = candidateValue.trim().toLocaleUpperCase("en-US");
  if (key === CoachMemoryFactKey.PRIORITY_SUBJECT) {
    const subject = taxonomySubjects.find(
      (item) =>
        item.slug.toLocaleLowerCase("tr-TR") ===
          candidateValue.trim().toLocaleLowerCase("tr-TR") ||
        item.name.toLocaleLowerCase("tr-TR") ===
          candidateValue.trim().toLocaleLowerCase("tr-TR"),
    );
    return subject?.name ?? null;
  }
  return ALLOWED_VALUES[key]?.includes(normalized) ? normalized : null;
}

export function validateMemoryCandidate(
  userMessage: string,
  candidate: MemoryCandidate,
  options: {
    now: Date;
    transientTtlDays: number;
    taxonomySubjects: Array<{ slug: string; name: string }>;
  },
): ValidatedMemoryFact | null {
  if (!userMessage.includes(candidate.sourceQuote)) return null;
  if (
    EMAIL_RE.test(candidate.sourceQuote) ||
    PHONE_RE.test(candidate.sourceQuote) ||
    NATIONAL_ID_RE.test(candidate.sourceQuote) ||
    SENSITIVE_RE.test(candidate.sourceQuote) ||
    hasSeriousDistressSignal(candidate.sourceQuote)
  ) {
    return null;
  }

  const key = Object.values(CoachMemoryFactKey).find(
    (item) => item === candidate.key,
  );
  if (!key) return null;

  const value = normalizeMemoryValue(
    key,
    candidate.value,
    options.taxonomySubjects,
  );
  if (!value) return null;

  return {
    key,
    value,
    expiresAt: isTransientMemoryKey(key)
      ? new Date(
          options.now.getTime() +
            options.transientTtlDays * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null,
  };
}

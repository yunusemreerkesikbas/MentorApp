import {
  CoachEvidenceType,
  CoachPersonalizationMode,
  CoachPersonalizationSignal,
  type CoachPersonalizationDto,
  type CoachPersonalizationSignal as CoachPersonalizationSignalType,
} from "@mentor/types";
import { groundingFact } from "./grounding-fact";
import type { PromptLocale } from "./prompt-locale";

const MARKER_PREFIX = "<<PERSONALIZATION:";
const MARKER_RE = /^\s*<<PERSONALIZATION:(RECENT_SESSIONS|TODAY_PLAN|MOOD|NONE)>>\s*/;

function isAvailable(
  signal: CoachPersonalizationSignalType,
  personalization: CoachPersonalizationDto,
): boolean {
  if (signal === CoachPersonalizationSignal.RECENT_SESSIONS) {
    return personalization.recentSessions !== null;
  }
  if (signal === CoachPersonalizationSignal.TODAY_PLAN) {
    return personalization.todayPlan !== null;
  }
  return personalization.moodLevel !== null;
}

function fallbackSignal(
  personalization: CoachPersonalizationDto,
): CoachPersonalizationSignalType | null {
  if (personalization.recentSessions) {
    return CoachPersonalizationSignal.RECENT_SESSIONS;
  }
  if (personalization.todayPlan) return CoachPersonalizationSignal.TODAY_PLAN;
  if (personalization.moodLevel !== null) return CoachPersonalizationSignal.MOOD;
  return null;
}

function evidenceSentence(
  signal: CoachPersonalizationSignalType,
  personalization: CoachPersonalizationDto,
  locale: PromptLocale,
): string | null {
  if (signal === CoachPersonalizationSignal.RECENT_SESSIONS) {
    return groundingFact({
      signal: "RECENT_SESSIONS",
      locale,
      recentSessions: personalization.recentSessions,
    });
  }
  if (signal === CoachPersonalizationSignal.TODAY_PLAN) {
    return groundingFact({
      signal: "TODAY_PLAN",
      locale,
      todayPlan: personalization.todayPlan,
    });
  }
  return groundingFact({
    signal: "MOOD",
    locale,
    moodLevel: personalization.moodLevel,
  });
}

function withFocusEvidence(
  personalization: CoachPersonalizationDto,
  focusLine: string,
): CoachPersonalizationDto {
  const usedEvidence = (personalization.usedEvidence ?? []).filter(
    (item) => item.summary !== focusLine,
  );
  usedEvidence.push({
    type: CoachEvidenceType.MOCK_PERFORMANCE,
    summary: focusLine,
    observedAt: new Date().toISOString(),
  });
  return { ...personalization, usedSignals: [], usedEvidence };
}

/** Replaces the model-only prefix with verified evidence that is visible inside the coach reply. */
export function applyCoachPersonalizationMarker(
  text: string,
  personalization: CoachPersonalizationDto,
  locale: PromptLocale,
  focusLine?: string | null,
): { text: string; personalization: CoachPersonalizationDto } {
  const match = MARKER_RE.exec(text);
  const requested = match?.[1] ?? null;
  const clean = match ? text.slice(match[0].length).trimStart() : text.trimStart();
  if (focusLine) {
    return {
      text: clean ? `${focusLine} ${clean}` : focusLine,
      personalization: withFocusEvidence(personalization, focusLine),
    };
  }
  let signal: CoachPersonalizationSignalType | null = null;

  if (requested && requested !== "NONE") {
    const candidate = requested as CoachPersonalizationSignalType;
    if (isAvailable(candidate, personalization)) signal = candidate;
  } else if (
    !match &&
    personalization.mode === CoachPersonalizationMode.GROUNDED
  ) {
    // Provider non-compliance must not turn a grounded reply back into an unverifiable generic claim.
    signal = fallbackSignal(personalization);
  }

  const sentence = signal
    ? evidenceSentence(signal, personalization, locale)
    : null;
  const visible = sentence ? `${sentence} ${clean}` : clean;
  return {
    text: visible,
    personalization: {
      ...personalization,
      usedSignals: signal && sentence ? [signal] : [],
    },
  };
}

/** Holds a split leading marker so it never flashes in streamed UI. */
export function createPersonalizationMarkerFilter(
  personalization: CoachPersonalizationDto,
  locale: PromptLocale,
  focusLine?: string | null,
): { push(delta: string): string; flush(): string } {
  let pending = "";
  let resolved = false;

  const resolve = (): string => {
    const result = applyCoachPersonalizationMarker(
      pending,
      personalization,
      locale,
      focusLine,
    );
    pending = "";
    resolved = true;
    return result.text;
  };

  return {
    push(delta: string): string {
      if (resolved) return delta;
      pending += delta;

      if (MARKER_RE.test(pending)) return resolve();
      const trimmed = pending.trimStart();
      if (MARKER_PREFIX.startsWith(trimmed)) return "";
      return resolve();
    },
    flush(): string {
      if (resolved || !pending) return "";
      return resolve();
    },
  };
}

const LIST_ITEM_RE = /^\s*(?:[-*•]|\d+[.)])\s+/m;

/** Stops a no-data reply from presenting a generic method menu as if it were personal advice. */
export function enforceNeedsInputReply(
  text: string,
  mode: CoachPersonalizationDto["mode"],
  locale: PromptLocale,
): string {
  if (mode !== CoachPersonalizationMode.NEEDS_INPUT || !LIST_ITEM_RE.test(text)) {
    return text;
  }
  return locale === "en"
    ? "What do you struggle with most so I can choose one step that fits you?"
    : "Sana uygun tek bir adım seçebilmem için en çok nerede zorlandığını söyler misin?";
}

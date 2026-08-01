import {
  CoachPersonalizationMode,
  CoachPersonalizationSignal,
  type CoachPersonalizationDto,
  type CoachPersonalizationSignal as CoachPersonalizationSignalType,
} from "@mentor/types";
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
): string {
  if (signal === CoachPersonalizationSignal.RECENT_SESSIONS) {
    const recent = personalization.recentSessions!;
    return locale === "en"
      ? `Over the last 7 days, you focused for ${recent.focusMinutes7d} minutes across ${recent.count7d} sessions.`
      : `Son 7 günde ${recent.count7d} seansla ${recent.focusMinutes7d} dakika odaklanmışsın.`;
  }
  if (signal === CoachPersonalizationSignal.TODAY_PLAN) {
    const plan = personalization.todayPlan!;
    return locale === "en"
      ? `You have completed ${plan.done} of ${plan.total} tasks in today's plan.`
      : `Bugünkü planındaki ${plan.total} görevin ${plan.done} tanesini tamamlamışsın.`;
  }
  const mood = personalization.moodLevel!;
  return locale === "en"
    ? `You logged today's mood as ${mood} out of 5.`
    : `Bugünkü ruh hali kaydın 5 üzerinden ${mood}.`;
}

/** Replaces the model-only prefix with verified evidence that is visible inside the coach reply. */
export function applyCoachPersonalizationMarker(
  text: string,
  personalization: CoachPersonalizationDto,
  locale: PromptLocale,
): { text: string; personalization: CoachPersonalizationDto } {
  const match = MARKER_RE.exec(text);
  const requested = match?.[1] ?? null;
  const clean = match ? text.slice(match[0].length).trimStart() : text.trimStart();
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

  const visible = signal ? `${evidenceSentence(signal, personalization, locale)} ${clean}` : clean;
  return {
    text: visible,
    personalization: {
      ...personalization,
      usedSignals: signal ? [signal] : [],
    },
  };
}

/** Holds a split leading marker so it never flashes in streamed UI. */
export function createPersonalizationMarkerFilter(
  personalization: CoachPersonalizationDto,
  locale: PromptLocale,
): { push(delta: string): string; flush(): string } {
  let pending = "";
  let resolved = false;

  const resolve = (): string => {
    const result = applyCoachPersonalizationMarker(pending, personalization, locale);
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

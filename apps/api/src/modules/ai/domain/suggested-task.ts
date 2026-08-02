/**
 * AI plan revizyonu (Dilim 4): the coach may end a reply with ONE in-band marker
 * `<<TASK{"title":"...","subject":"..."}>>`. The backend extracts + strips it; the FE renders a
 * "Plana ekle" card that deep-links to the existing /plan?add=1 prefill flow — the AI never writes
 * plan tasks itself (workstreams §2), the user confirms in the add sheet.
 */

export interface SuggestedTask {
  title: string;
  subject: string | null;
}

const MARKER_START = "<<TASK";
/** Marker at the END of the reply (the prompt demands it there). */
const MARKER_END_RE = /\s*<<TASK(\{(?:(?!>>)[\s\S])*?\})>>\s*$/;
/** Any complete marker, anywhere (defensive cleanup for a misbehaving model). */
const MARKER_ANY_RE = /<<TASK\{[\s\S]*?\}>>/g;

const FOLLOWUP_START = "<<FOLLOWUP";
/** Follow-up marker at the END (after TASK is stripped — order contract: FOLLOWUP then TASK). */
const FOLLOWUP_END_RE = /\s*<<FOLLOWUP(\[(?:(?!>>)[\s\S])*?\])>>\s*$/;
const FOLLOWUP_ANY_RE = /<<FOLLOWUP\[[\s\S]*?\]>>/g;

const MEMORY_START = "<<MEMORY";
const MEMORY_END_RE = /\s*<<MEMORY(\{(?:(?!>>)[\s\S])*?\})>>\s*$/;
const MEMORY_ANY_RE = /<<MEMORY\{[\s\S]*?\}>>/g;

/** Every in-band marker prefix the streaming filter must hold back. */
const MARKER_STARTS = [MARKER_START, FOLLOWUP_START, MEMORY_START];

const TITLE_MAX = 200;
const SUBJECT_MAX = 80;
const FOLLOWUP_MAX_ITEMS = 3;
const FOLLOWUP_ITEM_MAX = 120;
const MEMORY_VALUE_MAX = 80;
const MEMORY_QUOTE_MAX = 240;

export interface MemoryCandidate {
  key: string;
  value: string;
  sourceQuote: string;
}

export function extractMemoryCandidate(text: string): {
  text: string;
  memoryCandidate: MemoryCandidate | null;
} {
  const match = MEMORY_END_RE.exec(text);
  if (!match) return { text, memoryCandidate: null };
  const clean = text.slice(0, match.index).trimEnd();
  try {
    const parsed = JSON.parse(match[1]!) as Record<string, unknown>;
    const key = typeof parsed.key === "string" ? parsed.key.trim() : "";
    const value =
      typeof parsed.value === "string"
        ? parsed.value.trim().slice(0, MEMORY_VALUE_MAX)
        : "";
    const sourceQuote =
      typeof parsed.sourceQuote === "string"
        ? parsed.sourceQuote.trim().slice(0, MEMORY_QUOTE_MAX)
        : "";
    return {
      text: clean,
      memoryCandidate:
        key && value && sourceQuote ? { key, value, sourceQuote } : null,
    };
  } catch {
    return { text: clean, memoryCandidate: null };
  }
}

/**
 * Parse + strip the trailing task marker. Invalid/broken JSON is silently ignored — the marker is
 * still removed so the user never sees it.
 */
export function extractSuggestedTask(text: string): { text: string; task: SuggestedTask | null } {
  const match = MARKER_END_RE.exec(text);
  if (!match) return { text, task: null };

  const clean = text.slice(0, match.index).trimEnd();
  let task: SuggestedTask | null = null;
  try {
    const parsed = JSON.parse(match[1]!) as { title?: unknown; subject?: unknown };
    const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, TITLE_MAX) : "";
    if (title) {
      const subject =
        typeof parsed.subject === "string" && parsed.subject.trim()
          ? parsed.subject.trim().slice(0, SUBJECT_MAX)
          : null;
      task = { title, subject };
    }
  } catch {
    // Broken JSON — strip the marker, suggest nothing.
  }
  return { text: clean, task };
}

/**
 * Parse + strip the trailing follow-up marker (`<<FOLLOWUP["q1","q2"]>>`). Run AFTER
 * {@link extractSuggestedTask} — the prompt puts FOLLOWUP before the (optional) trailing TASK.
 * Invalid/broken JSON is silently ignored — the marker is still removed.
 */
export function extractFollowUps(text: string): { text: string; followUps: string[] } {
  const match = FOLLOWUP_END_RE.exec(text);
  if (!match) return { text, followUps: [] };

  const clean = text.slice(0, match.index).trimEnd();
  let followUps: string[] = [];
  try {
    const parsed = JSON.parse(match[1]!) as unknown;
    if (Array.isArray(parsed)) {
      followUps = parsed
        .filter((q): q is string => typeof q === "string")
        .map((q) => q.trim().slice(0, FOLLOWUP_ITEM_MAX))
        .filter((q) => q.length > 0)
        .slice(0, FOLLOWUP_MAX_ITEMS);
    }
  } catch {
    // Broken JSON — strip the marker, suggest nothing.
  }
  return { text: clean, followUps };
}

/**
 * Order-agnostic extraction of BOTH trailing markers. The prompt asks for FOLLOWUP-then-TASK, but
 * real models sometimes reverse them — a single-pass, order-assuming extraction then leaks the
 * other marker into the user-visible reply (seen live with gpt-4o-mini). Loops stripping whichever
 * marker is at the end until neither matches; first parsed value of each kind wins.
 */
export function extractReplyMarkers(text: string): {
  text: string;
  task: SuggestedTask | null;
  followUps: string[];
  memoryCandidate?: MemoryCandidate;
} {
  let current = text;
  let task: SuggestedTask | null = null;
  let followUps: string[] = [];
  let memoryCandidate: MemoryCandidate | null = null;

  for (;;) {
    const taskPass = extractSuggestedTask(current);
    if (taskPass.text !== current || taskPass.task) {
      current = taskPass.text;
      task = task ?? taskPass.task;
      continue;
    }
    const followUpPass = extractFollowUps(current);
    if (followUpPass.text !== current || followUpPass.followUps.length > 0) {
      current = followUpPass.text;
      if (followUps.length === 0) followUps = followUpPass.followUps;
      continue;
    }
    const memoryPass = extractMemoryCandidate(current);
    if (memoryPass.text !== current || memoryPass.memoryCandidate) {
      current = memoryPass.text;
      memoryCandidate = memoryCandidate ?? memoryPass.memoryCandidate;
      continue;
    }
    // Last-resort hygiene: a MALFORMED marker (e.g. `<<FOLLOWUP[...]]` missing its `>>`, seen
    // live) matches no end-anchored regex — never show marker debris to the user. Complete
    // markers anywhere are removed; from a dangling marker start onward the text is cut.
    if (firstMarkerIndex(current) !== -1) {
      current = current
        .replace(MARKER_ANY_RE, "")
        .replace(FOLLOWUP_ANY_RE, "")
        .replace(MEMORY_ANY_RE, "");
      const dangling = firstMarkerIndex(current);
      if (dangling !== -1) current = current.slice(0, dangling);
      current = current.trimEnd();
    }
    return {
      text: current,
      task,
      followUps,
      ...(memoryCandidate ? { memoryCandidate } : {}),
    };
  }
}

/** Longest k such that `text` ends with the first k chars of any marker prefix (0 when none). */
function trailingMarkerPrefixLen(text: string): number {
  let best = 0;
  for (const start of MARKER_STARTS) {
    const max = Math.min(text.length, start.length - 1);
    for (let k = max; k > best; k--) {
      if (text.endsWith(start.slice(0, k))) {
        best = k;
        break;
      }
    }
  }
  return best;
}

/** Earliest index of any marker start in `text`, or -1. */
function firstMarkerIndex(text: string): number {
  let idx = -1;
  for (const start of MARKER_STARTS) {
    const i = text.indexOf(start);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  return idx;
}

/**
 * Streaming holdback so no marker EVER leaks into deltas (even split across chunk boundaries).
 * `push` returns the safe text to emit; from the first `<<TASK` / `<<FOLLOWUP` on, everything is
 * held. `flush` (call at final) releases held text with any marker — complete or truncated — removed.
 */
export function createTaskMarkerFilter(): {
  push(delta: string): string;
  flush(): string;
} {
  let pending = "";
  let suppressing = false;

  return {
    push(delta: string): string {
      pending += delta;
      if (suppressing) return "";

      const idx = firstMarkerIndex(pending);
      if (idx !== -1) {
        const out = pending.slice(0, idx);
        pending = pending.slice(idx);
        suppressing = true;
        return out;
      }

      const hold = trailingMarkerPrefixLen(pending);
      const out = pending.slice(0, pending.length - hold);
      pending = pending.slice(pending.length - hold);
      return out;
    },

    flush(): string {
      let out = pending
        .replace(MARKER_ANY_RE, "")
        .replace(FOLLOWUP_ANY_RE, "")
        .replace(MEMORY_ANY_RE, "");
      // Truncated marker (stream cut mid-JSON) — drop from the marker start onward.
      const idx = firstMarkerIndex(out);
      if (idx !== -1) out = out.slice(0, idx);
      // Whitespace-only residue (the gap between two adjacent markers) — emit nothing.
      if (out.trim() === "") out = "";
      pending = "";
      suppressing = false;
      return out;
    },
  };
}

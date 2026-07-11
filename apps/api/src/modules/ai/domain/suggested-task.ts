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
const MARKER_END_RE = /\s*<<TASK(\{[\s\S]*?\})>>\s*$/;
/** Any complete marker, anywhere (defensive cleanup for a misbehaving model). */
const MARKER_ANY_RE = /<<TASK\{[\s\S]*?\}>>/g;

const TITLE_MAX = 200;
const SUBJECT_MAX = 80;

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

/** Longest k such that `text` ends with the first k chars of MARKER_START (0 when none). */
function trailingMarkerPrefixLen(text: string): number {
  const max = Math.min(text.length, MARKER_START.length - 1);
  for (let k = max; k > 0; k--) {
    if (text.endsWith(MARKER_START.slice(0, k))) return k;
  }
  return 0;
}

/**
 * Streaming holdback so the marker NEVER leaks into deltas (even split across chunk boundaries).
 * `push` returns the safe text to emit; from the first `<<TASK` on, everything is held.
 * `flush` (call at final) releases held text with any marker — complete or truncated — removed.
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

      const idx = pending.indexOf(MARKER_START);
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
      let out = pending.replace(MARKER_ANY_RE, "");
      // Truncated marker (stream cut mid-JSON) — drop from the marker start onward.
      const idx = out.indexOf(MARKER_START);
      if (idx !== -1) out = out.slice(0, idx);
      pending = "";
      suppressing = false;
      return out;
    },
  };
}

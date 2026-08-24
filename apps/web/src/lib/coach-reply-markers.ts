/**
 * Client-side hygiene for in-band coach markers (`<<TASK>>` / `<<FOLLOWUP>>` / `<<MEMORY>>`).
 * The API already strips these; this is a last line of defense so a leaked marker never
 * renders as raw text in a bubble.
 */

export interface RecoveredSuggestedTask {
  title: string;
  subject: string | null;
}

const TITLE_MAX = 200;
const SUBJECT_MAX = 80;

const DANGLING_MARKER_RE = /<<(TASK|FOLLOWUP|MEMORY)\b[\s\S]*$/i;
const DANGLING_TASK_JSON_RE = /<<TASK\s*(\{[\s\S]*?\})/;

export function sanitizeCoachDisplayText(text: string): string {
  return text.replace(DANGLING_MARKER_RE, "").trimEnd();
}

export function recoverSuggestedTask(text: string): RecoveredSuggestedTask | null {
  const match = DANGLING_TASK_JSON_RE.exec(text);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]!) as { title?: unknown; subject?: unknown };
    const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, TITLE_MAX) : "";
    if (!title) return null;
    const subject =
      typeof parsed.subject === "string" && parsed.subject.trim()
        ? parsed.subject.trim().slice(0, SUBJECT_MAX)
        : null;
    return { title, subject };
  } catch {
    return null;
  }
}

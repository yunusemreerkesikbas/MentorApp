const STORAGE_KEY = "mentor:coach-session:v1";
export const MAX_RECENT_TOPICS = 5;

/**
 * Messages now live on the backend (GET /v1/coach/messages) — sessionStorage keeps only the
 * lightweight recent-topic pills. Old v1 payloads with a `messages` array parse fine (ignored).
 */
export function loadRecentTopics(): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { recentTopics?: unknown };
    return Array.isArray(parsed.recentTopics)
      ? (parsed.recentTopics as string[]).slice(0, MAX_RECENT_TOPICS)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentTopics(recentTopics: string[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ recentTopics: recentTopics.slice(0, MAX_RECENT_TOPICS) }),
    );
  } catch {
    // Quota or private mode — topics stay in memory only.
  }
}

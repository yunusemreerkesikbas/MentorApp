import type { ChatMessage } from "./coach-transcript";

const STORAGE_KEY = "mentor:coach-session:v1";
export const MAX_RECENT_TOPICS = 5;

export interface StoredCoachSession {
  messages: ChatMessage[];
  recentTopics: string[];
}

export function loadCoachSession(): StoredCoachSession {
  if (typeof sessionStorage === "undefined") {
    return { messages: [], recentTopics: [] };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], recentTopics: [] };
    const parsed = JSON.parse(raw) as StoredCoachSession;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      recentTopics: Array.isArray(parsed.recentTopics)
        ? parsed.recentTopics.slice(0, MAX_RECENT_TOPICS)
        : [],
    };
  } catch {
    return { messages: [], recentTopics: [] };
  }
}

export function saveCoachSession(session: StoredCoachSession): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: session.messages,
        recentTopics: session.recentTopics.slice(0, MAX_RECENT_TOPICS),
      }),
    );
  } catch {
    // Quota or private mode — session stays in memory only.
  }
}

export function clearCoachMessages(): void {
  const current = loadCoachSession();
  saveCoachSession({ ...current, messages: [] });
}

import type { StudyRoomTheme } from "@mentor/types";
import { isStudyRoomTheme } from "./study-room-theme";

/**
 * What the session screen looks like when you are NOT sitting at anyone's table.
 *
 * The themed room stopped being a study-room feature: a solo session is still somewhere, and
 * the plain dark screen was a place only in the sense that a waiting room is. So the scene is
 * the default everywhere now and "sade görünüm" is the opt-out — which makes both of these
 * real preferences rather than per-visit moods, and preferences have to survive a reload.
 *
 * Device-local on purpose. Which room you like to work in is a property of where you are
 * sitting right now, not of your account, and it is not worth an API write per arrow press.
 *
 * Exposed as a `useSyncExternalStore` source rather than "read it in an effect": the server
 * has no `localStorage`, so the stored value cannot be the first render, and React's own
 * server-snapshot handshake is the supported way to say that. Reading it into state from an
 * effect does the same thing with an extra render and a lint error.
 */
const STORAGE_KEY = "mentor_session_scene";

export interface SessionScene {
  /** Theme for solo sessions. A seated session always uses its own room's theme instead. */
  theme: StudyRoomTheme;
  /** Scenery off — the old plain focus screen, whether seated or solo. */
  plain: boolean;
}

export const DEFAULT_SESSION_SCENE: SessionScene = { theme: "LIBRARY", plain: false };

/**
 * The snapshot React compares by reference, so it is read from storage once and then only
 * replaced on a real change — returning a fresh object per call would re-render forever.
 */
let cached: SessionScene | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): SessionScene {
  if (typeof window === "undefined") return DEFAULT_SESSION_SCENE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SESSION_SCENE;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_SESSION_SCENE;
    const { theme, plain } = parsed as Record<string, unknown>;
    return {
      // Validated, not trusted: this is user-writable storage, and a stale theme id from an
      // older build would otherwise index the asset maps to `undefined`.
      theme:
        typeof theme === "string" && isStudyRoomTheme(theme)
          ? theme
          : DEFAULT_SESSION_SCENE.theme,
      plain: plain === true,
    };
  } catch {
    return DEFAULT_SESSION_SCENE;
  }
}

export function subscribeSessionScene(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getSessionScene(): SessionScene {
  cached ??= readFromStorage();
  return cached;
}

/** Hydration snapshot: whatever the server rendered, which cannot have read storage. */
export function getServerSessionScene(): SessionScene {
  return DEFAULT_SESSION_SCENE;
}

export function setSessionScene(patch: Partial<SessionScene>): void {
  cached = { ...getSessionScene(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    /* private browsing — best-effort; the in-memory snapshot still applies for this visit */
  }
  listeners.forEach((fn) => fn());
}

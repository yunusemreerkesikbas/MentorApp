/**
 * The achievement chime's signature (E5 → G♯5 → B5) and the one AudioContext every achievement
 * sound shares. The scene voices the chime with the rest of its sound design
 * (achievement-scene-sfx.ts); this module owns the context and its unlock.
 */
export const ACHIEVEMENT_CHIME_NOTES: ReadonlyArray<{
  frequency: number;
  offset: number;
  duration: number;
}> = [
  { frequency: 659.25, offset: 0, duration: 0.52 },
  { frequency: 830.61, offset: 0.14, duration: 0.62 },
  { frequency: 987.77, offset: 0.3, duration: 0.78 },
];

let audioContext: AudioContext | null = null;

/**
 * The shared context, created on first use. Creating one before the page has had a user gesture
 * only yields a suspended context (and a console warning), so callers check
 * `pageHasUserActivation()` first.
 */
export function achievementAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContext();
    }
    return audioContext;
  } catch {
    return null;
  }
}

/** Browsers let audio start once the page has been interacted with (sticky activation). */
export function pageHasUserActivation(): boolean {
  if (typeof navigator === "undefined") return false;
  // Browsers without the API (older Safari) report nothing; trying costs only a warning there.
  return navigator.userActivation?.hasBeenActive ?? true;
}

/** Resumes the shared context. Autoplay policy or missing Web Audio must never block a celebration. */
export async function unlockAchievementAudio(): Promise<boolean> {
  const context = achievementAudioContext();
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

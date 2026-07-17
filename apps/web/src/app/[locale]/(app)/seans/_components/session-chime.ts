/**
 * Focus-end completion chime — a short WebAudio two-tone bell.
 * ponytail: synthesized instead of a committed audio asset; swap for a
 * public/audio/*.wav via the ambient-tracks pattern if a real sound is wanted.
 *
 * Deliberately uncoupled from the ambient-sound mute: the chime is a
 * functional alert, ambient mute only silences the background loop.
 */

let ctx: AudioContext | null = null;

/** Call from a user gesture (Başla click) so autoplay policy allows the chime. */
export function unlockChime(): void {
  if (typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // No WebAudio — chime silently unavailable.
  }
}

export function playChime(): void {
  const audio = ctx;
  if (!audio || audio.state !== "running") return;
  const tone = (frequency: number, offset: number) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + offset;
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  };
  tone(880, 0); // A5
  tone(1318.5, 0.18); // E6
}

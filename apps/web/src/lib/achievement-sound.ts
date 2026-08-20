export const ACHIEVEMENT_CHIME_NOTES: ReadonlyArray<{
  frequency: number;
  offset: number;
  duration: number;
}> = [
  { frequency: 659.25, offset: 0, duration: 0.52 },
  { frequency: 830.61, offset: 0.14, duration: 0.62 },
  { frequency: 987.77, offset: 0.3, duration: 0.78 },
];
export const ACHIEVEMENT_CHIME_MASTER_GAIN = 0.55;
export const ACHIEVEMENT_CHIME_NOTE_GAIN = 0.5;

let audioContext: AudioContext | null = null;

export async function unlockAchievementChime(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContext();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    return audioContext.state === "running";
  } catch {
    return false;
  }
}

export async function playAchievementChime(): Promise<boolean> {
  try {
    if (!(await unlockAchievementChime()) || !audioContext) return false;

    const master = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    const start = audioContext.currentTime + 0.01;
    master.gain.setValueAtTime(ACHIEVEMENT_CHIME_MASTER_GAIN, start);
    compressor.threshold.setValueAtTime(-18, start);
    compressor.knee.setValueAtTime(20, start);
    compressor.ratio.setValueAtTime(6, start);
    compressor.attack.setValueAtTime(0.003, start);
    compressor.release.setValueAtTime(0.2, start);
    master.connect(compressor).connect(audioContext.destination);

    for (const note of ACHIEVEMENT_CHIME_NOTES) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const noteStart = start + note.offset;
      const noteEnd = noteStart + note.duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(
        ACHIEVEMENT_CHIME_NOTE_GAIN,
        noteStart + 0.025,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain).connect(master);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    }

    const finalNote = ACHIEVEMENT_CHIME_NOTES.at(-1);
    if (finalNote) {
      window.setTimeout(
        () => {
          master.disconnect();
          compressor.disconnect();
        },
        (finalNote.offset + finalNote.duration + 0.1) * 1_000,
      );
    }
    return true;
  } catch {
    // Autoplay policy or unavailable Web Audio must not block the celebration.
    return false;
  }
}

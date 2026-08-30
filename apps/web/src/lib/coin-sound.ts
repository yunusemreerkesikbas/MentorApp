export const COIN_CHIME_NOTES: ReadonlyArray<{
  frequency: number;
  offset: number;
  duration: number;
}> = [
  { frequency: 987.77, offset: 0, duration: 0.35 }, // B5
  { frequency: 1318.51, offset: 0.12, duration: 0.55 }, // E6
];

export const COIN_CHIME_MASTER_GAIN = 0.4;
export const COIN_CHIME_NOTE_GAIN = 0.4;

let audioContext: AudioContext | null = null;

export async function unlockCoinChime(): Promise<boolean> {
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

export async function playCoinChime(): Promise<boolean> {
  try {
    if (!(await unlockCoinChime()) || !audioContext) return false;

    const master = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    const start = audioContext.currentTime + 0.01;
    master.gain.setValueAtTime(COIN_CHIME_MASTER_GAIN, start);
    compressor.threshold.setValueAtTime(-18, start);
    compressor.knee.setValueAtTime(20, start);
    compressor.ratio.setValueAtTime(6, start);
    compressor.attack.setValueAtTime(0.003, start);
    compressor.release.setValueAtTime(0.2, start);
    master.connect(compressor).connect(audioContext.destination);

    for (const note of COIN_CHIME_NOTES) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const noteStart = start + note.offset;
      const noteEnd = noteStart + note.duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(
        COIN_CHIME_NOTE_GAIN,
        noteStart + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain).connect(master);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    }

    const finalNote = COIN_CHIME_NOTES.at(-1);
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

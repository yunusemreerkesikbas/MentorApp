import { describe, expect, it } from "vitest";

import {
  COIN_CHIME_MASTER_GAIN,
  COIN_CHIME_NOTES,
  COIN_CHIME_NOTE_GAIN,
} from "./coin-sound";

describe("COIN_CHIME_NOTES", () => {
  it("uses an ascending two-note cheerful chime signature", () => {
    expect(COIN_CHIME_NOTES).toHaveLength(2);
    expect(COIN_CHIME_NOTES[1]!.frequency).toBeGreaterThan(
      COIN_CHIME_NOTES[0]!.frequency,
    );
    expect(
      Math.max(
        ...COIN_CHIME_NOTES.map(
          (note) => note.offset + note.duration,
        ),
      ),
    ).toBeLessThanOrEqual(1.0);
  });

  it("uses an audible but non-clipping output level", () => {
    const peakGain = COIN_CHIME_MASTER_GAIN * COIN_CHIME_NOTE_GAIN;
    expect(peakGain).toBeGreaterThanOrEqual(0.1);
    expect(peakGain).toBeLessThanOrEqual(0.3);
  });
});

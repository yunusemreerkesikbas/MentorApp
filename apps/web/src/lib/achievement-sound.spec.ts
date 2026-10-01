import { describe, expect, it } from "vitest";

import { ACHIEVEMENT_CHIME_NOTES } from "./achievement-sound";

describe("ACHIEVEMENT_CHIME_NOTES", () => {
  it("uses a short ascending three-note signature", () => {
    expect(ACHIEVEMENT_CHIME_NOTES).toHaveLength(3);
    expect(ACHIEVEMENT_CHIME_NOTES[1]!.frequency).toBeGreaterThan(
      ACHIEVEMENT_CHIME_NOTES[0]!.frequency,
    );
    expect(ACHIEVEMENT_CHIME_NOTES[2]!.frequency).toBeGreaterThan(
      ACHIEVEMENT_CHIME_NOTES[1]!.frequency,
    );
    expect(
      Math.max(
        ...ACHIEVEMENT_CHIME_NOTES.map(
          (note) => note.offset + note.duration,
        ),
      ),
    ).toBeLessThanOrEqual(1.2);
  });
});

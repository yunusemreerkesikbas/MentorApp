import { describe, expect, it } from "vitest";
import { hasSeriousDistressSignal } from "./serious-distress";

describe("hasSeriousDistressSignal", () => {
  it.each([
    "Hiçbir şeyin anlamı yok gibi hissediyorum.",
    "Artık yaşamak istemiyorum.",
    "I feel like nothing matters anymore.",
    "I want to hurt myself.",
  ])("detects an explicit serious distress phrase: %s", (note) => {
    expect(hasSeriousDistressSignal(note)).toBe(true);
  });

  it.each([null, "", "Bugün matematik sorularına çalışmak çok zor geldi."])(
    "does not flag an ordinary study struggle: %s",
    (note) => {
      expect(hasSeriousDistressSignal(note)).toBe(false);
    },
  );
});
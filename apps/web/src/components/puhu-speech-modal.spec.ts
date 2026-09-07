import { describe, expect, it } from "vitest";
import { PuhuSpeechModal } from "./puhu-speech-modal";

describe("PuhuSpeechModal", () => {
  it("exports PuhuSpeechModal as a function component", () => {
    expect(typeof PuhuSpeechModal).toBe("function");
    expect(PuhuSpeechModal.name).toBe("PuhuSpeechModal");
  });
});

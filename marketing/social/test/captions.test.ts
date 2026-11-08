import { expect, it } from "vitest";
import { formatCaption, HASHTAGS } from "../src/captions";

it("formats a single-image caption", () => {
  expect(formatCaption({ text: "Merhaba", alt: "Puhu" })).toBe(`Merhaba\n\n${HASHTAGS}\n\nAlt metin:\nPuhu\n`);
});

it("numbers carousel alt texts", () => {
  expect(formatCaption({ text: "M", alt: ["a", "b"] })).toBe(`M\n\n${HASHTAGS}\n\nAlt metin:\n1. a\n2. b\n`);
});

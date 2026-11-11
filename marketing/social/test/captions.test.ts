import { expect, it } from "vitest";
import { AD_HEADLINE_MAX, CAPTIONS, formatCaption, HASHTAGS } from "../src/captions";

it("prints a piece's own hashtags and its paid fields", () => {
  expect(formatCaption({ text: "M", alt: "a", tags: "#x", ad: { headline: "H", button: "B" } })).toBe("M\n\n#x\n\nAlt metin:\na\n\nReklam başlığı: H\nButon: B\n");
});

it("keeps every ad headline within Meta's limit", () => {
  for (const [id, c] of Object.entries(CAPTIONS)) if (c?.ad) expect(c.ad.headline.length, id).toBeLessThanOrEqual(AD_HEADLINE_MAX);
});

it("formats a single-image caption", () => {
  expect(formatCaption({ text: "Merhaba", alt: "Puhu" })).toBe(`Merhaba\n\n${HASHTAGS}\n\nAlt metin:\nPuhu\n`);
});

it("numbers carousel alt texts", () => {
  expect(formatCaption({ text: "M", alt: ["a", "b"] })).toBe(`M\n\n${HASHTAGS}\n\nAlt metin:\n1. a\n2. b\n`);
});

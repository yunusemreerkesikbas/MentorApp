import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import trMessages from "../../messages/tr.json";

/** "Bilgi" became the public Blog (2026-09-23): no copy may send people to a section that is gone. */
describe("retired Bilgi section name", () => {
  it("appears in no message, in either locale", () => {
    for (const messages of [trMessages, enMessages]) {
      expect(JSON.stringify(messages)).not.toMatch(
        /Bilgi [Mm]erkez|Bilgi makale|Knowledge (Center|Hub)|knowledge articles/,
      );
    }
  });
});

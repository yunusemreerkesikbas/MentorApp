import { describe, expect, it } from "vitest";
import { buildInviteLink } from "./invite-link";

describe("buildInviteLink", () => {
  const origin = "https://puhukoc.test";

  it("is absolute and localized for Turkish (default locale, no prefix)", () => {
    expect(buildInviteLink("PUHU-TEST2345", "tr", origin)).toBe(
      "https://puhukoc.test/davet/PUHU-TEST2345",
    );
  });

  it("carries the English prefix and segment for English", () => {
    expect(buildInviteLink("PUHU-TEST2345", "en", origin)).toBe(
      "https://puhukoc.test/en/invite/PUHU-TEST2345",
    );
  });
});

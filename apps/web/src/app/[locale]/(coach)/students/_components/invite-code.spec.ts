import { describe, expect, it } from "vitest";
import { maskInviteCode } from "./invite-code";

describe("maskInviteCode", () => {
  it("keeps the structural prefix and hides the secret", () => {
    expect(maskInviteCode("MENTOR-KOC-7F3QA9XZ")).toBe("MENTOR-KOC-••••••••");
  });

  it("masks one dot per hidden character, so the length never leaks a shorter code", () => {
    expect(maskInviteCode("MENTOR-KOC-AB")).toBe("MENTOR-KOC-••");
  });

  it("masks everything when there is no separator to split on", () => {
    expect(maskInviteCode("ABCD")).toBe("••••");
  });

  it("does not fall over on an empty code", () => {
    expect(maskInviteCode("")).toBe("");
  });

  it("splits on the LAST separator, so a hyphen in the secret stays hidden", () => {
    // Greedy prefix: anything the generator puts before the final `-` is structure.
    expect(maskInviteCode("A-B-CD")).toBe("A-B-••");
  });
});

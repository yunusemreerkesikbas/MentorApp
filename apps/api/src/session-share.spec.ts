import { describe, expect, it } from "vitest";
import { resolveSessionShare } from "../../web/src/lib/session-share";

describe("resolveSessionShare", () => {
  it("floors seconds to whole minutes and carries the streak", () => {
    expect(resolveSessionShare(1530, 7)).toEqual({ minutes: 25, streakDays: 7 });
  });

  it("drops the streak clause when there is no streak", () => {
    expect(resolveSessionShare(1500, 0)).toEqual({ minutes: 25, streakDays: null });
    expect(resolveSessionShare(1500, null)).toEqual({ minutes: 25, streakDays: null });
  });

  it("returns null when under a minute was focused (button hidden)", () => {
    expect(resolveSessionShare(59, 5)).toBeNull();
    expect(resolveSessionShare(0, 5)).toBeNull();
  });
});

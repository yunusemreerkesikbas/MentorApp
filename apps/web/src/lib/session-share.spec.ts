import { describe, expect, it } from "vitest";
import { resolveSessionShare, shareDaypart } from "./session-share";

describe("resolveSessionShare", () => {
  it("shares a counted session in whole minutes", () => {
    expect(resolveSessionShare(50 * 60 + 59, true)).toEqual({ minutes: 50 });
  });

  it("hides the card for a session that did not count, however long", () => {
    expect(resolveSessionShare(89, false)).toBeNull();
    expect(resolveSessionShare(30 * 60, false)).toBeNull();
  });

  it("hides the card under a minute", () => {
    expect(resolveSessionShare(59, true)).toBeNull();
  });
});

describe("shareDaypart", () => {
  const at = (hour: number) => new Date(2026, 9, 6, hour, 30);

  it("names the part of the day by local hour", () => {
    expect(shareDaypart(at(5))).toBe("morning");
    expect(shareDaypart(at(11))).toBe("noon");
    expect(shareDaypart(at(14))).toBe("afternoon");
    expect(shareDaypart(at(18))).toBe("evening");
    expect(shareDaypart(at(22))).toBe("night");
    expect(shareDaypart(at(3))).toBe("night");
  });
});

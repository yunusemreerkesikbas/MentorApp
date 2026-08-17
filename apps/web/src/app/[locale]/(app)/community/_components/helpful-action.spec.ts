import { describe, expect, it } from "vitest";

import { getHelpfulActionPresentation } from "./helpful-action";

describe("helpful action presentation", () => {
  it("shows only the vote count while retaining an accessible label", () => {
    expect(
      getHelpfulActionPresentation({ count: 3, accessibleLabel: "Faydalı" }),
    ).toEqual({ visibleCount: "3", ariaLabel: "Faydalı: 3" });
  });

  it("explains why the owner's vote action is unavailable", () => {
    expect(
      getHelpfulActionPresentation({
        count: 3,
        accessibleLabel: "Faydalı",
        unavailableLabel: "Kendi içeriğine oy veremezsin",
        canVote: false,
      }),
    ).toEqual({
      visibleCount: "3",
      ariaLabel: "Kendi içeriğine oy veremezsin. Faydalı: 3",
    });
  });
});

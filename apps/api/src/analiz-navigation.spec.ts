import { describe, expect, it } from "vitest";
import {
  buildAnalizTabHref,
  shouldNavigateAnalizTab,
} from "../../web/src/app/[locale]/(app)/analiz/_components/analiz-types";

describe("analysis tab navigation", () => {
  it("does not navigate when the requested tab is already active", () => {
    expect(shouldNavigateAnalizTab("gir", "gir")).toBe(false);
    expect(shouldNavigateAnalizTab("gelisim", "gir")).toBe(true);
  });

  it("updates the tab locally without carrying an RSC transport parameter", () => {
    expect(
      buildAnalizTabHref(
        "/analiz",
        "?tab=gir&_rsc=transport&source=summary",
        "gelisim",
      ),
    ).toBe("/analiz?tab=gelisim&source=summary");
  });
});


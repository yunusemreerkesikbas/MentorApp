import { afterEach, describe, expect, it, vi } from "vitest";
import { trackAnalysisAction } from "./analytics";

describe("analysis action privacy", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([null, "accepted"])("requires consent and projects only categorical fields (%s)", (consent) => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", { localStorage: { getItem: () => consent }, dataLayer });
    const payload = { action: "plan" as const, focusSource: "PHOTO_SIGNAL" as const, cycleState: "signal" as const, net: 26.75, userId: "private", note: "private note" };
    trackAnalysisAction(payload);
    expect(dataLayer).toEqual(consent ? [["event", "analysis_action", { action: "plan", focus_source: "PHOTO_SIGNAL", cycle_state: "signal" }]] : []);
  });
});

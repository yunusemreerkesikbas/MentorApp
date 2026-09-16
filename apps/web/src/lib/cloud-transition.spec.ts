import { describe, expect, it } from "vitest";

import { cloudTransitionReducer } from "./cloud-transition";

describe("cloud transition", () => {
  it("covers the current route, then waits for the destination before revealing it", () => {
    expect(cloudTransitionReducer("idle", "start")).toBe("covering");
    expect(cloudTransitionReducer("covering", "covered")).toBe("covered");
    // A route change alone is not the signal: the new page may still be a skeleton.
    expect(cloudTransitionReducer("covered", "ready")).toBe("revealing");
    expect(cloudTransitionReducer("revealing", "revealed")).toBe("idle");
  });

  it("releases the overlay when the destination never reports in", () => {
    expect(cloudTransitionReducer("covered", "timeout")).toBe("revealing");
  });

  it("ignores a ready signal that arrives before the cover is closed", () => {
    expect(cloudTransitionReducer("covering", "ready")).toBe("covering");
  });

  it("ignores duplicate starts while a transition is active", () => {
    expect(cloudTransitionReducer("covering", "start")).toBe("covering");
    expect(cloudTransitionReducer("covered", "start")).toBe("covered");
  });
});

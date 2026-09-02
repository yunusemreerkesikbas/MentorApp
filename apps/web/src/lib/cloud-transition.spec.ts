import { describe, expect, it } from "vitest";

import { cloudTransitionReducer } from "./cloud-transition";

describe("cloud transition", () => {
  it("covers the current route before revealing the destination", () => {
    expect(cloudTransitionReducer("idle", "start")).toBe("covering");
    expect(cloudTransitionReducer("covering", "covered")).toBe("covered");
    expect(cloudTransitionReducer("covered", "routeChanged")).toBe("revealing");
    expect(cloudTransitionReducer("revealing", "revealed")).toBe("idle");
  });

  it("releases the overlay when navigation times out", () => {
    expect(cloudTransitionReducer("covered", "timeout")).toBe("revealing");
  });

  it("ignores duplicate starts while a transition is active", () => {
    expect(cloudTransitionReducer("covering", "start")).toBe("covering");
    expect(cloudTransitionReducer("covered", "start")).toBe("covered");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFinalWelcomeStep, nextWelcomeStep, previousWelcomeStep, welcomeSkipStep, welcomeStartStep } from "./welcome-flow.ts";

describe("welcome flow", () => {
  it("first open starts at slide 1, a returning user at slide 4", () => {
    assert.equal(welcomeStartStep(false), 0);
    assert.equal(welcomeStartStep(true), 3);
  });
  it("next/previous clamp and skip lands on the last slide", () => {
    assert.equal(nextWelcomeStep(0), 1);
    assert.equal(nextWelcomeStep(3), 3);
    assert.equal(previousWelcomeStep(0), 0);
    assert.equal(previousWelcomeStep(2), 1);
    assert.equal(welcomeSkipStep(), 3);
    assert.equal(isFinalWelcomeStep(3), true);
    assert.equal(isFinalWelcomeStep(2), false);
  });
});

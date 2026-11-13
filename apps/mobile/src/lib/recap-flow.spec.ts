import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clipDriftCheckDue,
  createRecapCompletion,
  headlineScale,
  recapOpenStep,
} from "../components/recap/recap-flow.ts";

describe("weekly recap open step", () => {
  it("reads a report the student already has", () => {
    assert.equal(recapOpenStep({ mode: "OWNED", reportId: "r1" }, false), "read");
  });

  it("opens an OWNED week that has no report yet, like the web", () => {
    assert.equal(recapOpenStep({ mode: "OWNED", reportId: null }, false), "open");
  });

  it("asks before spending Coin, then opens", () => {
    assert.equal(recapOpenStep({ mode: "COIN", reportId: null }, false), "confirm");
    assert.equal(recapOpenStep({ mode: "COIN", reportId: null }, true), "open");
  });

  it("does nothing for a locked week", () => {
    assert.equal(recapOpenStep({ mode: "NONE", reportId: null }, false), "none");
  });
});

describe("weekly recap completion", () => {
  it("asks for what the week earned once the PUT settles", async () => {
    const events: string[] = [];
    const complete = createRecapCompletion(
      async () => {
        events.push("put");
      },
      () => events.push("refresh"),
    );
    complete();
    complete();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ["put", "refresh"]);
  });

  it("tries again after a failed PUT", async () => {
    let calls = 0;
    const complete = createRecapCompletion(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error("offline");
      },
      () => undefined,
    );
    complete();
    await new Promise((resolve) => setImmediate(resolve));
    complete();
    await new Promise((resolve) => setImmediate(resolve));
    complete();
    assert.equal(calls, 2);
  });
});

describe("story headline scale", () => {
  it("keeps full size from a 411 dp phone up, and shrinks with the column below it", () => {
    assert.equal(headlineScale(411), 1);
    assert.equal(headlineScale(600), 1);
    // A 360 dp phone has a 296 dp column against 347: 36 dp type becomes ~30.7 dp.
    assert.equal(Math.round(headlineScale(360) * 36 * 10) / 10, 30.7);
  });
});

describe("clip drift check", () => {
  it("checks on the first tick, then at most once a second of story time", () => {
    assert.equal(clipDriftCheckDue(0, null), true);
    assert.equal(clipDriftCheckDue(950, 0), false);
    assert.equal(clipDriftCheckDue(1000, 0), true);
    assert.equal(clipDriftCheckDue(0, 3000), true);
  });
});

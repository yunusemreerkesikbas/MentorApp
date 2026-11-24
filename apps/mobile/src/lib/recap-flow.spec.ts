import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clipDriftCheckDue,
  createRecapCompletion,
  createRecapShareLock,
  headlineScale,
  recapArchiveOfferAllowed,
  recapArchiveParams,
  recapOpenStep,
  recapPuhuNote,
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

describe("weekly recap Puhu note", () => {
  it("shows the narration the student already owns", () => {
    assert.deepEqual(recapPuhuNote("Haftayı tamamladın.", " Bir adım daha! "), {
      text: "Bir adım daha!",
      personalized: true,
    });
  });

  it("uses the weekly closing message when there is no saved narration", () => {
    for (const narration of [undefined, "", "  "]) {
      assert.deepEqual(recapPuhuNote("Haftayı tamamladın.", narration), {
        text: "Haftayı tamamladın.",
        personalized: false,
      });
    }
  });
});

describe("weekly recap sharing", () => {
  it("opens one system share sheet at a time and allows another attempt after failure", async () => {
    const shareOnce = createRecapShareLock();
    let started = 0;
    let fail!: (error: Error) => void;
    const first = shareOnce(() => {
      started += 1;
      return new Promise<void>((_resolve, reject) => { fail = reject; });
    });

    await shareOnce(async () => { started += 1; });
    assert.equal(started, 1);
    fail(new Error("native sharing failed"));
    await assert.rejects(first, /native sharing failed/);

    await shareOnce(async () => { started += 1; });
    assert.equal(started, 2);
  });
});

describe("weekly recap archive navigation", () => {
  const stored = { id: "report-1", examId: "previous-exam", weekStart: "2026-10-05" };

  it("reads an open snapshot by its report ID regardless of the active exam", () => {
    assert.deepEqual(recapArchiveParams(stored), { reportId: "report-1" });
  });

  it("routes a historical purchase to the original exam and week for recovery", () => {
    assert.deepEqual(recapArchiveParams({ ...stored, id: "ledger-1", requiresOpening: true }), {
      examId: "previous-exam", weekStart: "2026-10-05", archive: "1",
    });
  });

  it("only lets an archived purchase recover for free or open an existing report", () => {
    const owned = { enabled: true, mode: "OWNED", cost: 0, reportId: null } as const;
    assert.equal(recapArchiveOfferAllowed(owned), true);
    assert.equal(recapArchiveOfferAllowed({ ...owned, enabled: false }), false);
    assert.equal(recapArchiveOfferAllowed({ ...owned, mode: "COIN", cost: 250 }), false);
    assert.equal(recapArchiveOfferAllowed({ ...owned, mode: "PREMIUM" }), false);
    assert.equal(recapArchiveOfferAllowed({ ...owned, cost: 2 }), false);
    assert.equal(recapArchiveOfferAllowed({ ...owned, enabled: false, reportId: "report-1" }), true);
  });
});

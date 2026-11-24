import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeTimelineDay,
  orderTimelineTasks,
  railFillRatio,
  readPlanViewMode,
  timelineEndSpace,
  timelinePinTarget,
  timelineSnapOffsets,
  scrollSync,
} from "./plan-timeline.ts";

describe("readPlanViewMode", () => {
  it("reopens Timeline or Takvim when saved", () => {
    assert.equal(readPlanViewMode("timeline"), "timeline");
    assert.equal(readPlanViewMode("calendar"), "calendar");
    for (const raw of ["list", "week", "garbage", "", null]) assert.equal(readPlanViewMode(raw), "list");
  });
});

describe("timelinePinTarget", () => {
  const days = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];

  it("opens on today when the week holds it", () => {
    assert.equal(timelinePinTarget(days, "2026-11-14", "2026-11-11"), "2026-11-14");
  });

  it("opens on the selected day in any other week", () => {
    assert.equal(timelinePinTarget(days, "2026-11-20", "2026-11-11"), "2026-11-11");
  });
});

describe("activeTimelineDay", () => {
  const tops = [
    { iso: "a", top: 0 },
    { iso: "b", top: 120 },
    { iso: "c", top: 300 },
  ];

  it("picks the day whose top is nearest the scroll offset", () => {
    assert.equal(activeTimelineDay(tops, 50), "a");
    assert.equal(activeTimelineDay(tops, 200), "b");
    assert.equal(activeTimelineDay(tops, 290), "c");
  });

  it("keeps the earlier day on a tie and the last day past the end", () => {
    assert.equal(activeTimelineDay(tops, 60), "a");
    assert.equal(activeTimelineDay(tops, 900), "c");
  });

  it("has no day before anything is measured", () => {
    assert.equal(activeTimelineDay([], 0), null);
  });
});

describe("orderTimelineTasks", () => {
  it("puts pending tasks first and keeps each group's order", () => {
    const tasks = [
      { id: 1, status: "DONE" },
      { id: 2, status: "PENDING" },
      { id: 3, status: "DONE" },
      { id: 4, status: "PENDING" },
    ];
    assert.deepEqual(orderTimelineTasks(tasks).map((task) => task.id), [2, 4, 1, 3]);
  });
});

describe("railFillRatio", () => {
  it("fills to the active day's marker and stays within 0..1", () => {
    assert.equal(railFillRatio(78, 200), 0.5);
    assert.equal(railFillRatio(900, 200), 1);
    assert.equal(railFillRatio(0, 0), 1);
  });
});

describe("timelineSnapOffsets", () => {
  it("stops at each day's top when every day fits", () => {
    assert.deepEqual(timelineSnapOffsets([0, 100, 220], [100, 120, 80], 300), [0, 100, 220]);
  });

  it("adds stops inside a day taller than the scroller so its last rows can rest in view", () => {
    // stride = half the viewport, 150; the day's last stop is its bottom − viewport.
    assert.deepEqual(timelineSnapOffsets([0, 700], [700, 50], 300), [0, 150, 300, 400, 700]);
  });

  it("lets every row up to half the scroller tall rest whole at some stop", () => {
    const viewport = 300;
    const row = viewport / 2;
    const stops = timelineSnapOffsets([0, 700], [700, 50], viewport);
    for (let y = 0; y + row <= 700; y += 5) {
      assert.ok(stops.some((stop) => stop <= y && y + row <= stop + viewport), `row at ${y}`);
    }
  });

  it("ignores a scroller with no height yet", () => {
    assert.deepEqual(timelineSnapOffsets([0, 100], [500, 50], 0), [0, 100]);
  });
});

describe("scrollSync", () => {
  const base: Parameters<typeof scrollSync>[0] = {
    range: "2026-11-09",
    pinnedRange: null,
    loading: false,
    measured: true,
    request: 0,
    handled: 0,
  };

  it("waits for the week's tasks and every day's size before the pin", () => {
    assert.equal(scrollSync({ ...base, loading: true }), "wait");
    assert.equal(scrollSync({ ...base, measured: false }), "wait");
    assert.equal(scrollSync(base), "pin");
  });

  it("pins a new week with a pick waiting, so the pin goes to the pick", () => {
    assert.equal(scrollSync({ ...base, pinnedRange: "2026-11-02", request: 3, handled: 2 }), "pin");
  });

  it("scrolls once per pick from outside the scroller, a re-tap of the selected day included", () => {
    const pinned = { ...base, pinnedRange: base.range };
    assert.equal(scrollSync({ ...pinned, request: 4, handled: 3 }), "scroll");
    // A day the scroller reached on its own is no request, however late its render lands.
    assert.equal(scrollSync({ ...pinned, request: 4, handled: 4 }), "none");
  });
});

describe("timelineEndSpace", () => {
  it("lets the last day rest at the top and no further", () => {
    // viewport 448, last day 118 tall, 16 of content padding: the content ends at its top + 448.
    assert.equal(timelineEndSpace(448, 118, 16), 314);
  });

  it("needs no space after a last day taller than the scroller", () => {
    assert.equal(timelineEndSpace(448, 600, 16), 0);
  });

  it("reserves the web's space until the last day is measured", () => {
    assert.equal(timelineEndSpace(448, undefined, 16), 376);
  });
});

import { describe, expect, it } from "vitest";

import { selectNextEvent } from "./calendar.util";

describe("selectNextEvent", () => {
  it("ignores past events and picks the nearest upcoming event", () => {
    const selected = selectNextEvent(
      [
        event("EXAM_DATE", "2026-07-12T06:00:00.000Z"),
        event("RESULT_DATE", "2026-08-01T07:00:00.000Z"),
        event("APPLICATION_END", "2026-07-20T07:00:00.000Z"),
      ],
      "2026-07-18",
    );

    expect(selected?.type).toBe("APPLICATION_END");
  });

  it("includes an event occurring today", () => {
    const selected = selectNextEvent(
      [event("EXAM_DATE", "2026-07-18T06:00:00.000Z")],
      "2026-07-18",
    );

    expect(selected?.type).toBe("EXAM_DATE");
  });

  it("breaks equal-time ties by event type", () => {
    const at = "2026-07-20T07:00:00.000Z";
    const selected = selectNextEvent(
      [event("RESULT_DATE", at), event("APPLICATION_END", at)],
      "2026-07-18",
    );

    expect(selected?.type).toBe("APPLICATION_END");
  });

  it("returns null when there are no upcoming events", () => {
    expect(
      selectNextEvent(
        [event("EXAM_DATE", "2026-07-12T06:00:00.000Z")],
        "2026-07-18",
      ),
    ).toBeNull();
  });
});

function event(type: string, eventAt: string) {
  return { type, eventAt: new Date(eventAt) };
}

import { describe, expect, it } from "vitest";

import {
  initialCampusWalkState,
  reduceCampusWalkState,
} from "./campus-walk-state";

describe("campus walk avatar state", () => {
  it("shows arrival, walking, and idle phases for the selected stop", () => {
    const selected = reduceCampusWalkState(initialCampusWalkState, {
      type: "POI_CHANGED",
      poiId: "library",
    });
    const arrived = reduceCampusWalkState(selected, {
      type: "PANORAMA_READY",
      poiId: "library",
    });
    const walking = reduceCampusWalkState(arrived, {
      type: "PANORAMA_MOVED",
      poiId: "library",
    });
    const settled = reduceCampusWalkState(walking, {
      type: "MOTION_SETTLED",
      poiId: "library",
    });

    expect(arrived.phase).toBe("ARRIVING");
    expect(walking.phase).toBe("WALKING");
    expect(settled.phase).toBe("IDLE");
  });

  it("ignores delayed movement events from the previously selected stop", () => {
    const library = reduceCampusWalkState(initialCampusWalkState, {
      type: "POI_CHANGED",
      poiId: "library",
    });
    const cultureCenter = reduceCampusWalkState(library, {
      type: "POI_CHANGED",
      poiId: "culture-center",
    });
    const staleEvent = reduceCampusWalkState(cultureCenter, {
      type: "PANORAMA_MOVED",
      poiId: "library",
    });

    expect(staleEvent).toEqual({ poiId: "culture-center", phase: "IDLE" });
  });
});


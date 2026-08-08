import { describe, expect, it } from "vitest";

import { buildGroundRelativeCameraOptions } from "./campus-camera";

describe("campus 3D camera", () => {
  it("keeps a zero-altitude stop relative to the local ground", () => {
    const camera = buildGroundRelativeCameraOptions({
      center: { lat: 38.026, lng: 32.511, altitude: 0 },
      heading: 120,
      tilt: 50,
      range: 700,
    });

    expect(camera).toEqual({
      altitudeMode: "RELATIVE_TO_GROUND",
      center: { lat: 38.026, lng: 32.511, altitude: 0 },
      heading: 120,
      tilt: 50,
      range: 700,
    });
  });
});

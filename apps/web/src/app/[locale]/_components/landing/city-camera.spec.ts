import { describe, expect, it } from "vitest";
import {
  CAMERA_KEYS,
  STOP_COUNT,
  cameraAt,
  frontOpacity,
  interiorOpacity,
  layerTransform,
  panelPresence,
  skyGradient,
  stopAt,
} from "./city-camera";

const wide = CAMERA_KEYS.wide;
const segment = 1 / (STOP_COUNT - 1);

describe("cameraAt", () => {
  it("holds each stop's key around the stop", () => {
    const [x, y, z, ax, ay, sky] = wide[1];
    expect(cameraAt(segment, wide)).toEqual({ x, y, z, ax, ay, sky });
    expect(cameraAt(segment + segment * 0.1, wide).x).toBe(x);
  });

  it("clamps progress outside 0..1", () => {
    expect(cameraAt(-1, wide)).toEqual(cameraAt(0, wide));
    expect(cameraAt(2, wide)).toEqual(cameraAt(1, wide));
  });

  it("pans halfway between two stops at the middle of the move", () => {
    const camera = cameraAt(1.5 * segment, wide);
    expect(camera.x).toBeCloseTo((wide[1][0] + wide[2][0]) / 2);
  });

  it("zooms in log space from the wide shot to a window", () => {
    const camera = cameraAt(0.5 * segment, wide);
    expect(camera.z).toBeCloseTo(Math.sqrt(wide[0][2] * wide[1][2]));
  });

  it("pulls back a little between two close-ups", () => {
    expect(cameraAt(1.5 * segment, wide).z).toBeLessThan(wide[1][2]);
  });
});

describe("stopAt", () => {
  it("names the nearest stop", () => {
    expect(stopAt(0)).toBe(0);
    expect(stopAt(1.4 * segment)).toBe(1);
    expect(stopAt(1.6 * segment)).toBe(2);
    expect(stopAt(1)).toBe(STOP_COUNT - 1);
  });
});

describe("panelPresence", () => {
  it("is full on its stop and gone by the next one", () => {
    expect(panelPresence(3 * segment, 3)).toBe(1);
    expect(panelPresence(4 * segment, 3)).toBe(0);
    expect(panelPresence(2 * segment, 3)).toBe(0);
  });

  it("fades during the move", () => {
    const halfway = panelPresence(3.3 * segment, 3);
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(1);
  });
});

describe("skyGradient", () => {
  it("is the night sky at 0 and dawn at 1", () => {
    expect(skyGradient(0)).toBe("linear-gradient(180deg, rgb(7, 18, 42) 0%, rgb(27, 53, 99) 100%)");
    expect(skyGradient(1)).toBe(
      "linear-gradient(180deg, rgb(141, 178, 230) 0%, rgb(255, 210, 160) 100%)",
    );
  });
});

describe("zoom-driven fades", () => {
  it("shows the window interiors only once the camera is close", () => {
    expect(interiorOpacity(wide[0][2])).toBe(0);
    expect(interiorOpacity(wide[1][2])).toBe(1);
  });

  it("fades the foreground out before it can cover a window", () => {
    expect(frontOpacity(wide[0][2])).toBe(1);
    expect(frontOpacity(wide[7][2])).toBe(0);
  });
});

describe("layerTransform", () => {
  it("puts the camera's world point on the screen anchor", () => {
    const camera = { x: 800, y: 560, z: 1, ax: 0.5, ay: 0.5, sky: 0 };
    // 1600×1000 is the world's own size, so the fit scale is 1; layers start at world x = -400.
    expect(layerTransform(camera, 1, 1600, 1000)).toBe("translate3d(-400.0px,-60.0px,0) scale(1.0000)");
  });

  it("moves near layers more than far ones when the camera zooms", () => {
    const camera = { x: 800, y: 560, z: 2, ax: 0.5, ay: 0.5, sky: 0 };
    expect(layerTransform(camera, 0.25, 1600, 1000)).toContain("scale(1.2500)");
    expect(layerTransform(camera, 1, 1600, 1000)).toContain("scale(2.0000)");
  });
});

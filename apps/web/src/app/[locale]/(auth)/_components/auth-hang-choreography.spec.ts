import { describe, expect, it } from "vitest";

import {
  HANG_ART,
  HANG_DISPLAY_PX,
  HANG_GRIP_Y,
  HANG_OVERHANG_PX,
  HANG_SPRITES,
  HANG_WING_CLIP,
  hangPose,
  hangWingClipPaths,
} from "./auth-hang-choreography";

describe("hangPose", () => {
  it("lets password cover beat a blink", () => {
    expect(hangPose("password", true, "left")).toBe("cover");
  });

  it("lets name/email look-down beat a blink", () => {
    expect(hangPose("text", true, "right")).toBe("lookDown");
  });

  it("hides idle gaze behind a blink", () => {
    expect(hangPose("idle", true, "left")).toBe("blink");
    expect(hangPose("idle", false, "left")).toBe("gazeLeft");
    expect(hangPose("idle", false, "right")).toBe("gazeRight");
    expect(hangPose("idle", false, "centre")).toBe("rest");
  });
});

describe("HANG_ART", () => {
  it("keeps the grip line on the shared canvas", () => {
    expect(HANG_GRIP_Y).toBeCloseTo(160 / 384);
    expect(HANG_DISPLAY_PX).toBe(176);
    expect(HANG_OVERHANG_PX).toBe(Math.round(HANG_DISPLAY_PX * HANG_GRIP_Y));
    expect(HANG_ART.source).toBe(384);
  });

  it("points every pose at a hang sprite", () => {
    for (const src of Object.values(HANG_SPRITES)) {
      expect(src.startsWith("/mascot/puhu/auth/hang-")).toBe(true);
    }
  });

  it("clips only the side wings on the front copy", () => {
    expect(HANG_WING_CLIP.left.left).toBeCloseTo(74 / 384);
    expect(1 - HANG_WING_CLIP.right.right).toBeCloseTo(310 / 384);
    const clips = hangWingClipPaths();
    expect(clips.left.startsWith("inset(")).toBe(true);
    expect(clips.right.startsWith("inset(")).toBe(true);
  });
});

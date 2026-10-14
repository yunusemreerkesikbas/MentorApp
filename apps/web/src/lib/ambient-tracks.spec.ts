import { describe, expect, it } from "vitest";
import { AMBIENT_THEME_LAYERS, ambientLayers, migrateAmbientTrackId } from "./ambient-tracks";

describe("ambientLayers", () => {
  it("follows the scene for `scene`", () => {
    expect(ambientLayers("scene", "CAFE")).toBe(AMBIENT_THEME_LAYERS.CAFE);
    expect(ambientLayers("scene", "HOME")).toBe(AMBIENT_THEME_LAYERS.HOME);
  });

  it("keeps a pinned room whatever the scene", () => {
    expect(ambientLayers("library", "CAFE")).toBe(AMBIENT_THEME_LAYERS.LIBRARY);
  });

  it("is silent for `off`", () => {
    expect(ambientLayers("off", "LIBRARY")).toBeNull();
  });
});

describe("migrateAmbientTrackId", () => {
  it("moves the old synth tracks to `scene` and drops unknown ids", () => {
    expect(migrateAmbientTrackId("rain")).toBe("scene");
    expect(migrateAmbientTrackId("cafe")).toBe("cafe");
    expect(migrateAmbientTrackId("jazz")).toBeNull();
  });
});

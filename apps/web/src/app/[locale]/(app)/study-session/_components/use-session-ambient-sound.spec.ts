import { describe, expect, it } from "vitest";
import { ambientLayers } from "@/lib/ambient-tracks";
import {
  applyAmbientTrackSelection,
  parseStoredAmbientPreference,
  resolveEffectiveAmbientTrackId,
  shouldPlayAudio,
} from "./use-session-ambient-sound";

describe("useSessionAmbientSound preference & silence transitions", () => {
  it("uses suggestedTrackId ('scene') on initial open when no preference is stored, then preserves 'off' (Sessiz) after selection", () => {
    const initial = parseStoredAmbientPreference(null);
    expect(initial).toEqual({
      trackId: "off",
      muted: false,
      hasOwnPreference: false,
    });
    expect(resolveEffectiveAmbientTrackId(initial, "scene")).toBe("scene");

    // Initial page open -> Sessiz
    const afterOff = applyAmbientTrackSelection(initial, "off");
    expect(afterOff).toEqual({
      trackId: "off",
      muted: false,
      hasOwnPreference: true,
    });
    expect(resolveEffectiveAmbientTrackId(afterOff, "scene")).toBe("off");
  });

  it("preserves Sessiz across Kafe -> Sessiz and Kütüphane -> Sessiz transitions", () => {
    const initial = parseStoredAmbientPreference(null);

    const cafe = applyAmbientTrackSelection(initial, "cafe");
    expect(resolveEffectiveAmbientTrackId(cafe, "scene")).toBe("cafe");

    const cafeToOff = applyAmbientTrackSelection(cafe, "off");
    expect(resolveEffectiveAmbientTrackId(cafeToOff, "scene")).toBe("off");

    const library = applyAmbientTrackSelection(cafeToOff, "library");
    expect(resolveEffectiveAmbientTrackId(library, "scene")).toBe("library");

    const libraryToOff = applyAmbientTrackSelection(library, "off");
    expect(resolveEffectiveAmbientTrackId(libraryToOff, "scene")).toBe("off");
  });

  it("keeps Sessiz silent across room switches (LIBRARY -> CAFE -> HOME) and timer start/pause/reset", () => {
    const state = applyAmbientTrackSelection(parseStoredAmbientPreference(null), "off");
    const effective = resolveEffectiveAmbientTrackId(state, "scene");
    expect(effective).toBe("off");

    for (const room of ["LIBRARY", "CAFE", "HOME"] as const) {
      expect(ambientLayers(effective, room)).toBeNull();
    }

    for (const phase of ["idle", "focus", "break"] as const) {
      expect(shouldPlayAudio(phase, false, effective, state.muted)).toBe(false);
      expect(shouldPlayAudio(phase, true, effective, state.muted)).toBe(false);
    }
  });

  it("restores stored Sessiz preference from localStorage without reverting to suggestedTrackId", () => {
    const reloaded = parseStoredAmbientPreference(
      JSON.stringify({ trackId: "off", muted: false }),
    );
    expect(reloaded.hasOwnPreference).toBe(true);
    expect(resolveEffectiveAmbientTrackId(reloaded, "scene")).toBe("off");
  });

  it("keeps other sound and room selections working when active", () => {
    const state = applyAmbientTrackSelection(parseStoredAmbientPreference(null), "cafe");
    const effective = resolveEffectiveAmbientTrackId(state, "scene");
    expect(effective).toBe("cafe");
    expect(ambientLayers(effective, "LIBRARY")).toEqual({
      ambience: "/audio/scene-cafe-ambience.mp3",
      music: "/audio/scene-cafe-music.mp3",
    });
    expect(shouldPlayAudio("focus", false, effective, false)).toBe(true);
    expect(shouldPlayAudio("focus", true, effective, false)).toBe(false);
    expect(shouldPlayAudio("idle", false, effective, false)).toBe(false);
  });
});

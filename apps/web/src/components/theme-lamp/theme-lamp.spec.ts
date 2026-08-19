import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const COMPONENT_DIR = dirname(fileURLToPath(import.meta.url));

function read(file: string): string {
  return readFileSync(resolve(COMPONENT_DIR, file), "utf8");
}

describe("theme lamp presentation", () => {
  it("keeps the button semantics of the toggle it replaces", () => {
    const lamp = read("theme-lamp.tsx");

    expect(lamp).toContain('type="button"');
    expect(lamp).toContain("aria-pressed={lit}");
    expect(lamp).toContain('aria-label={lit ? t("theme_to_light") : t("theme_to_dark")}');
    expect(lamp).toContain("focus-visible:ring-[var(--color-focus-ring)]");
  });

  it("flips the theme before it plays the pull, never after", () => {
    const lamp = read("theme-lamp.tsx");
    const toggleAt = lamp.indexOf("toggleTheme();");
    const pullAt = lamp.indexOf("playPull(next);");

    expect(toggleAt).toBeGreaterThan(-1);
    expect(pullAt).toBeGreaterThan(toggleAt);
  });

  it("paints the scene from the lamp token family, not raw colour", () => {
    const lamp = read("theme-lamp.tsx");
    const cord = read("lamp-cord.tsx");

    expect(lamp).toContain("mentor-theme-lamp");
    expect(lamp).toContain("var(--lamp-glow)");
    expect(cord).toContain("var(--lamp-cord)");
    expect(cord).toContain("var(--lamp-shade-rim)");
    expect(lamp).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(cord).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("routes every motion through the reduced-motion flag", () => {
    const lamp = read("theme-lamp.tsx");
    const cord = read("lamp-cord.tsx");
    const hook = read("use-lamp-choreography.ts");

    expect(lamp).toContain("reduceMotion ? { duration: 0 } : LEAN_SPRING");
    expect(lamp).toContain("x: reduceMotion ? 0 : leanX, y: reduceMotion ? 0 : leanY");
    expect(cord).toContain("reduceMotion");
    expect(hook).toContain("if (reduceMotion) return;");
  });

  it("stacks all three owl sprites and crossfades to the active pose", () => {
    const lamp = read("theme-lamp.tsx");

    expect(lamp).toContain("POSES.map((candidate)");
    expect(lamp).toContain("opacity: candidate === pose ? 1 : 0");
  });

  it("binds pointer tracking to the scene instead of the window", () => {
    const hook = read("use-lamp-choreography.ts");

    expect(hook).toContain("sceneHandlers");
    expect(hook).toContain("onPointerLeave");
    expect(hook).not.toContain("window.addEventListener");
    expect(hook).toContain('document.visibilityState !== "visible"');
  });

  it("masks the light spill to the owl so it cannot paint a rectangle", () => {
    const lamp = read("theme-lamp.tsx");

    expect(lamp).toContain("maskImage: `url(${OWL_SPRITES.rest})`");
    expect(lamp).toContain("WebkitMaskImage: `url(${OWL_SPRITES.rest})`");
  });
});

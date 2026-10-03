import { describe, expect, it } from "vitest";
import {
  DESK_BOOK_RATIO,
  DESK_MAX_SPIN_DEG,
  deskBookThickness,
  deskDueTabs,
  deskFlyTarget,
  deskFlyTargetSingle,
  deskPose,
  deskTapeColor,
  DESK_TAPE_COLORS,
  shadeHex,
} from "./notebook-desk";

describe("notebook desk", () => {
  it("puts every notebook down the same way on every visit", () => {
    expect(deskPose("99999999-9999-4999-8999-999999999999")).toEqual(
      deskPose("99999999-9999-4999-8999-999999999999"),
    );
    expect(deskPose("a")).not.toEqual(deskPose("b"));
  });

  it("keeps the spin small and never perfectly square", () => {
    for (let index = 0; index < 200; index += 1) {
      const pose = deskPose(`notebook-${index}`);
      expect(Math.abs(pose.rotate)).toBeLessThanOrEqual(DESK_MAX_SPIN_DEG);
      expect(Math.abs(pose.rotate)).toBeGreaterThanOrEqual(1);
      expect(Math.abs(pose.dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(pose.dy)).toBeLessThanOrEqual(1);
    }
  });

  it("thickens with written pages and stops at a ceiling", () => {
    expect(deskBookThickness(0)).toBe(2.6);
    expect(deskBookThickness(10)).toBeGreaterThan(deskBookThickness(1));
    expect(deskBookThickness(500)).toBe(7.2);
    expect(deskBookThickness(-3)).toBe(2.6);
  });

  it("grows at most five due tabs", () => {
    expect(deskDueTabs(0)).toBe(0);
    expect(deskDueTabs(3)).toBe(3);
    expect(deskDueTabs(11)).toBe(5);
  });

  it("shades a cover colour towards black or white", () => {
    expect(shadeHex("#33415c", 0)).toBe("#33415c");
    expect(shadeHex("#33415c", -1)).toBe("#000000");
    expect(shadeHex("#33415c", 1)).toBe("#ffffff");
    expect(shadeHex("#808080", -0.5)).toBe("#404040");
    expect(shadeHex("not-a-colour", -0.4)).toBe("not-a-colour");
  });

  it("gives the same subject the same tape", () => {
    expect(deskTapeColor("matematik")).toBe(deskTapeColor("matematik"));
    expect(DESK_TAPE_COLORS).toContain(deskTapeColor("tarih"));
  });

  it("flies the closed book to where its opened spread is centred", () => {
    const frame = { x: 240, y: 0, width: 1200, height: 900 };
    const target = deskFlyTarget(frame);
    // The spine (the closed book's left edge) sits on the frame's centre line.
    expect(target.x).toBeCloseTo(240 + 600, 6);
    expect(target.width / target.height).toBeCloseTo(DESK_BOOK_RATIO, 6);
    // Opened, the spread (2 × width) still fits inside the frame's padding.
    expect(target.width * 2).toBeLessThanOrEqual(1200 - 64 + 1e-6);
    expect(target.y).toBeGreaterThanOrEqual(72);
    expect(target.y + target.height).toBeLessThanOrEqual(900 - 72 + 1e-6);
  });

  it("fills a phone with one leaf instead of a spread", () => {
    const frame = { x: 0, y: 64, width: 390, height: 700 };
    const target = deskFlyTargetSingle(frame);
    expect(target.width).toBeLessThanOrEqual(390 - 24 + 1e-6);
    expect(target.x).toBeCloseTo((390 - target.width) / 2, 6);
    expect(target.width / target.height).toBeCloseTo(DESK_BOOK_RATIO, 6);
  });
});

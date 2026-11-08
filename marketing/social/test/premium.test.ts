import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SOON } from "../src/brand";
import { COPY } from "../src/copy";
import { PIECES } from "../src/pieces";

// Feed posts and reels stay on the profile, so the Premium ones never say "ÇOK YAKINDA" (owner, 2026-11-08).
const ON_PROFILE = ["PF1", "PF2", "PR1", "PR2"] as const;

it("registers the six Premium pieces", () => {
  expect(PIECES.filter((p) => p.id.startsWith("P")).map((p) => `${p.id}:${p.format}`)).toEqual([
    "PF1:feed",
    "PF2:feed",
    "PS1:story",
    "PS2:story",
    "PR1:reel",
    "PR2:reel",
  ]);
});

it("keeps ÇOK YAKINDA off the Premium feed posts and reel", () => {
  for (const id of ON_PROFILE) {
    const strings = Object.values(COPY[id] ?? {});
    expect(strings.length, id).toBeGreaterThan(0);
    expect(strings.filter((s) => s.includes(SOON)), id).toEqual([]);
    expect(readFileSync(`src/pieces/${id}.tsx`, "utf8"), id).not.toMatch(/\bSOON\b/);
  }
});

it("closes the Premium reels with their own tag, not the default ÇOK YAKINDA pill", () => {
  for (const id of ["PR1", "PR2"]) expect(readFileSync(`src/pieces/${id}.tsx`, "utf8"), id).toMatch(/<EndCard[^>]*\btag=/);
});

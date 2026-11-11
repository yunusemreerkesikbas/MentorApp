import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SOON } from "../src/brand";
import { COPY } from "../src/copy";
import { PIECES } from "../src/pieces";
import { EVENTS, sceneOf } from "../src/t1/timeline";

it("keeps ÇOK YAKINDA, PREMIUM and reward numbers out of T1", () => {
  const strings = Object.values(COPY.T1!);
  expect(strings.filter((s) => s.includes(SOON) || /PREMIUM/i.test(s) || /\bCoin\b/.test(s))).toEqual([]);
  // the only XP string is the session reward "+5 XP" (scene 10), never on the chest
  expect(strings.filter((s) => /XP/.test(s))).toEqual(["+5 XP"]);
});

it("closes T1 on the end card at 1800 with the five exams in place of the pill", () => {
  expect(sceneOf("17").from + EVENTS["17"].endCard!).toBe(PIECES.find((p) => p.id === "T1")!.video!.endCardFrom);
  const s17 = readFileSync("src/t1/scenes/S17.tsx", "utf8");
  expect(s17).toMatch(/<EndCard[^>]*\btag=\{EXAMS\}/);
  expect(s17).toMatch(/const EXAMS = [^;]*\{T\.exams\}/);
  expect(COPY.T1!.exams).toBe("KPSS · YKS · LGS · ALES · DGS");
});

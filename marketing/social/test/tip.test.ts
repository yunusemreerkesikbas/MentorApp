import { expect, it } from "vitest";
import { TIP_LIMITS } from "../src/components/Tip";
import { COPY } from "../src/copy";

const KEYS = ["tag", "footer", "c1Head", "c1Body", "c1Note", "c2Head", "c2Body", "c3Head", "c3Body", "c4Head", "c4Body", "c5Head", "c5Body", "c5Note"];

it.each(["K1", "K2"] as const)("%s has every card's copy within the layout limits", (id) => {
  const copy = COPY[id]!;
  expect(Object.keys(copy).sort()).toEqual([...KEYS].sort());
  for (const n of [1, 2, 3, 4, 5]) {
    expect(copy[`c${n}Head`]!.length, `c${n}Head`).toBeLessThanOrEqual(TIP_LIMITS.head);
    expect(copy[`c${n}Body`]!.length, `c${n}Body`).toBeLessThanOrEqual(TIP_LIMITS.body);
  }
});

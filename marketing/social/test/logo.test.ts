import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { WORDMARK, WORDMARK_VIEWBOX } from "../src/wordmark";

it("draws the same puhukoc wordmark as @mentor/ui", () => {
  const ui = readFileSync("../../packages/ui/src/components/logo.tsx", "utf8");
  expect(ui).toContain(`const WORDMARK = "${WORDMARK}";`);
  expect(ui).toContain(`viewBox="${WORDMARK_VIEWBOX}"`);
});

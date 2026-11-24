import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { checkCopy } from "../src/copy-check";

const dir = join(__dirname, "..", "ambassadors");
// The message itself: everything under the first heading, without Markdown headings.
const body = (file: string) =>
  readFileSync(join(dir, file), "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n")
    .trim();

it.each(["ilk-masa-mesaj.md", "elci-mesaj.md", "brief.md"])("%s follows the copy rules", (file) => {
  expect(checkCopy(body(file))).toEqual([]);
});

it.each(["ilk-masa-mesaj.md", "elci-mesaj.md"])("%s fits in one direct message", (file) => {
  expect(body(file).length).toBeLessThanOrEqual(700);
});

it.each(["elci-mesaj.md", "brief.md"])("%s says the post is labelled as an işbirliği", (file) => {
  expect(body(file)).toContain("işbirliği");
});

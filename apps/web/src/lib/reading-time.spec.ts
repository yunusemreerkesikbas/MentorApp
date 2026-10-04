import { describe, expect, it } from "vitest";
import { readingMinutes } from "./reading-time";

describe("readingMinutes", () => {
  it("never reports less than a minute", () => {
    expect(readingMinutes("## Kısa", "MARKDOWN")).toBe(1);
  });

  it("reads 200 words a minute, rounding up", () => {
    expect(readingMinutes(Array(401).fill("kelime").join(" "), "MARKDOWN")).toBe(3);
  });

  it("does not count HTML tags or Markdown link targets as words", () => {
    expect(
      readingMinutes(`<p>${Array(200).fill("<strong>söz</strong>").join(" ")}</p>`, "HTML"),
    ).toBe(1);
    expect(
      readingMinutes(Array(201).fill("[ÖSYM](https://www.osym.gov.tr/a/b)").join(" "), "MARKDOWN"),
    ).toBe(2);
  });
});

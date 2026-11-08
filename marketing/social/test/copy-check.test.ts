import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPTIONS } from "../src/captions";
import { COPY } from "../src/copy";
import { checkAll, checkCopy } from "../src/copy-check";

describe("checkCopy", () => {
  it("accepts clean copy", () => {
    expect(checkCopy("Yerini kap!")).toEqual([]);
    expect(checkCopy("yapay zekâ koçun")).toEqual([]);
  });

  it("allows one ! per sentence", () => {
    expect(checkCopy("Hadi! Başla!")).toEqual([]);
    expect(checkCopy("Hadi başla!!")).toHaveLength(1);
  });

  it("flags AI as a word only", () => {
    expect(checkCopy("AI koçun hazır")).toHaveLength(1);
    expect(checkCopy("MAIL kutun")).toEqual([]);
  });

  it("flags FOMO phrases in any case, Turkish casing included", () => {
    expect(checkCopy("Son şans, kaçırma")).toHaveLength(2);
    expect(checkCopy("SON ŞANS, KAÇIRMA")).toHaveLength(2);
  });

  it("flags the em dash", () => {
    expect(checkCopy("Puhu — yanında")).toHaveLength(1);
  });
});

describe("checkAll", () => {
  it("names where each problem sits", () => {
    expect(checkAll({ F1: { head: "AI yasak!!" } }, { F1: { text: "Kaçırma", alt: "x" } })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ where: "F1.head" }),
        expect.objectContaining({ where: "F1.caption" }),
      ]),
    );
  });

  it("finds nothing in the real copy", () => {
    expect(checkAll(COPY, CAPTIONS)).toEqual([]);
  });
});

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

it("never uses CSS textTransform (uppercase breaks Turkish İ)", () => {
  const hits = files("src").filter((f) => /textTransform/.test(readFileSync(f, "utf8")));
  expect(hits).toEqual([]);
});

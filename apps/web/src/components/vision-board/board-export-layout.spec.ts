import { describe, expect, it } from "vitest";
import {
  alignAnchorX,
  boardImageSrc,
  coverRect,
  frameHasPlate,
  frameInsets,
  needsCrossOrigin,
  textBlockTop,
  wrapText,
} from "./board-export-layout";

/**
 * The blob case is the one that bites: `resolveApiUrl` only recognises http(s) and would prefix a
 * `blob:` preview with the API base, breaking both the just-uploaded thumbnail and the export.
 */
describe("boardImageSrc", () => {
  it("passes a blob preview through untouched", () => {
    const blob = "blob:http://localhost:3000/8f2b-uuid";
    expect(boardImageSrc(blob)).toBe(blob);
  });

  it("passes a data URI through untouched", () => {
    expect(boardImageSrc("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  it("leaves an absolute CDN url alone", () => {
    expect(boardImageSrc("https://cdn.example/x.jpg")).toBe("https://cdn.example/x.jpg");
  });

  it("resolves an API-relative path against the API base", () => {
    expect(boardImageSrc("/v1/storage/fake-object?key=a")).toMatch(
      /^https?:\/\/.+\/v1\/storage\/fake-object\?key=a$/,
    );
  });
});

describe("needsCrossOrigin", () => {
  /** Setting crossOrigin on a same-origin blob turns a plain load into a CORS request for nothing. */
  it("is false for blob and data urls", () => {
    expect(needsCrossOrigin("blob:http://localhost:3000/x")).toBe(false);
    expect(needsCrossOrigin("data:image/png;base64,AAA")).toBe(false);
  });

  it("is true for anything fetched over the network", () => {
    expect(needsCrossOrigin("https://cdn.example/x.jpg")).toBe(true);
    expect(needsCrossOrigin("/v1/storage/fake-object?key=a")).toBe(true);
  });
});

/** Stand-in for canvas text metrics: every glyph is 10 units wide. */
const measure = (line: string) => line.length * 10;

describe("coverRect", () => {
  it("crops the sides of a source wider than the box", () => {
    const rect = coverRect(400, 200, 100, 100);
    expect(rect).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200 });
  });

  it("crops the top and bottom of a source taller than the box", () => {
    const rect = coverRect(200, 400, 100, 100);
    expect(rect).toEqual({ sx: 0, sy: 100, sw: 200, sh: 200 });
  });

  it("uses the whole source when the ratios match", () => {
    expect(coverRect(300, 150, 200, 100)).toEqual({ sx: 0, sy: 0, sw: 300, sh: 150 });
  });

  it("keeps the crop centred", () => {
    const rect = coverRect(1000, 100, 100, 100);
    expect(rect.sx).toBe((1000 - 100) / 2);
  });

  /** A photo that failed to decode reports 0×0; the exporter must not divide by it. */
  it("survives a zero-sized source", () => {
    expect(() => coverRect(0, 0, 100, 100)).not.toThrow();
    expect(coverRect(0, 0, 100, 100)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});

describe("wrapText", () => {
  it("keeps a short line whole", () => {
    expect(wrapText("hedef", 100, measure)).toEqual(["hedef"]);
  });

  it("breaks between words when the line is full", () => {
    // "bir iki" = 70, "bir iki uc" = 100 → fits; adding "dort" overflows.
    expect(wrapText("bir iki uc dort", 100, measure)).toEqual(["bir iki uc", "dort"]);
  });

  it("preserves explicit newlines", () => {
    expect(wrapText("bir\niki", 100, measure)).toEqual(["bir", "iki"]);
  });

  it("keeps an empty paragraph as a blank line", () => {
    expect(wrapText("bir\n\niki", 100, measure)).toEqual(["bir", "", "iki"]);
  });

  /** `word-break: break-word` in the DOM — a single long word must not overflow the box. */
  it("breaks a word longer than the line", () => {
    expect(wrapText("abcdefghijklmno", 50, measure)).toEqual(["abcde", "fghij", "klmno"]);
  });

  it("never drops content", () => {
    const text = "bilgisayar muhendisi olmak istiyorum";
    const joined = wrapText(text, 100, measure).join(" ");
    expect(joined.replace(/\s+/g, "")).toBe(text.replace(/\s+/g, ""));
  });
});

describe("textBlockTop", () => {
  it("centres a single line", () => {
    expect(textBlockTop(100, 1, 20)).toBe(40);
  });

  it("centres a multi-line block", () => {
    expect(textBlockTop(100, 3, 20)).toBe(20);
  });

  /** More text than box: the block overflows evenly rather than sticking to the top. */
  it("goes negative when the block is taller than the box", () => {
    expect(textBlockTop(50, 4, 20)).toBe(-15);
  });
});

describe("alignAnchorX", () => {
  it("anchors each alignment where canvas expects it", () => {
    expect(alignAnchorX("left", 200)).toBe(0);
    expect(alignAnchorX("center", 200)).toBe(100);
    expect(alignAnchorX("right", 200)).toBe(200);
  });
});

describe("frameInsets", () => {
  /** The Polaroid tell: a heavier bottom edge. Equal padding would just look matted. */
  it("gives the polaroid a heavier bottom edge", () => {
    const insets = frameInsets("polaroid");
    expect(insets.bottom).toBeGreaterThan(insets.top);
  });

  it("gives frameless presets no insets", () => {
    expect(frameInsets("none")).toMatchObject({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(frameInsets("tape")).toMatchObject({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("gives rounded a corner radius and no insets", () => {
    const insets = frameInsets("rounded");
    expect(insets.radius).toBeGreaterThan(0);
    expect(insets.top).toBe(0);
  });

  it("knows which presets paint a plate behind the photo", () => {
    expect(frameHasPlate("polaroid")).toBe(true);
    expect(frameHasPlate("white")).toBe(true);
    expect(frameHasPlate("none")).toBe(false);
    expect(frameHasPlate("rounded")).toBe(false);
  });
});

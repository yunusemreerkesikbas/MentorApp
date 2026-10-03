import { describe, expect, it } from "vitest";
import { nextView, spreadOf } from "./notebook-shell-layout";

describe("turning through the book", () => {
  it("goes cover, contents, then the writing pages two at a time", () => {
    expect(nextView({ kind: "cover" }, 1)).toEqual({ kind: "contents" });
    expect(nextView({ kind: "contents" }, 1)).toEqual({ kind: "spread", left: 0 });
    expect(nextView({ kind: "spread", left: 0 }, 1)).toEqual({ kind: "spread", left: 2 });
  });

  it("comes back the same way and stops at the cover", () => {
    expect(nextView({ kind: "spread", left: 2 }, -1)).toEqual({ kind: "spread", left: 0 });
    expect(nextView({ kind: "spread", left: 0 }, -1)).toEqual({ kind: "contents" });
    expect(nextView({ kind: "contents" }, -1)).toEqual({ kind: "cover" });
    expect(nextView({ kind: "cover" }, -1)).toEqual({ kind: "cover" });
  });

  it("finds a page's spread and side", () => {
    expect(spreadOf(0)).toEqual({ left: 0, side: "left" });
    expect(spreadOf(5)).toEqual({ left: 4, side: "right" });
    expect(spreadOf(8)).toEqual({ left: 8, side: "left" });
  });
});

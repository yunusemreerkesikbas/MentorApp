import { describe, expect, it } from "vitest";

import {
  advanceTopBannerIndex,
  parseDismissedIds,
  serializeDismissedIds,
} from "./top-banner-state";

describe("advanceTopBannerIndex", () => {
  it("keeps a single-item banner stable without a rotation target", () => {
    expect(advanceTopBannerIndex(0, 1)).toBe(0);
  });

  it("rotates multiple items and wraps back to the first item", () => {
    expect(advanceTopBannerIndex(0, 3)).toBe(1);
    expect(advanceTopBannerIndex(2, 3)).toBe(0);
  });

  it("normalizes an index after the available item list shrinks", () => {
    expect(advanceTopBannerIndex(4, 2)).toBe(1);
    expect(advanceTopBannerIndex(2, 0)).toBe(0);
  });
});

describe("parseDismissedIds", () => {
  it("treats absent storage as nothing dismissed", () => {
    expect(parseDismissedIds(null)).toEqual(new Set());
    expect(parseDismissedIds("")).toEqual(new Set());
  });

  it("reads back the ids it wrote", () => {
    const ids = new Set(["promotion", "rewarded-coin"]);
    expect(parseDismissedIds(serializeDismissedIds(ids))).toEqual(ids);
  });

  it("ignores the v1 boolean value instead of throwing", () => {
    // v1 stored "1" under a different key; a stale value must never break the dashboard.
    expect(parseDismissedIds("1")).toEqual(new Set());
  });

  it("survives corrupt or hand-edited storage", () => {
    expect(parseDismissedIds("{not json")).toEqual(new Set());
    expect(parseDismissedIds('{"a":1}')).toEqual(new Set());
    expect(parseDismissedIds("null")).toEqual(new Set());
  });

  it("keeps only string entries", () => {
    expect(parseDismissedIds('["promotion",42,null,{"id":"x"}]')).toEqual(new Set(["promotion"]));
  });
});

describe("serializeDismissedIds", () => {
  it("writes a stable, order-independent value", () => {
    expect(serializeDismissedIds(new Set(["b", "a"]))).toBe(
      serializeDismissedIds(new Set(["a", "b"])),
    );
  });
});

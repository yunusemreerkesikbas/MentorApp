import { describe, expect, it } from "vitest";

import { parseIdSet, serializeIdSet } from "./seen-ids";

describe("parseIdSet", () => {
  it("treats absent storage as nothing dismissed", () => {
    expect(parseIdSet(null)).toEqual(new Set());
    expect(parseIdSet("")).toEqual(new Set());
  });

  it("reads back the ids it wrote", () => {
    const ids = new Set(["promotion", "rewarded-coin"]);
    expect(parseIdSet(serializeIdSet(ids))).toEqual(ids);
  });

  it("ignores the v1 boolean value instead of throwing", () => {
    // v1 stored "1" under a different key; a stale value must never break the dashboard.
    expect(parseIdSet("1")).toEqual(new Set());
  });

  it("survives corrupt or hand-edited storage", () => {
    expect(parseIdSet("{not json")).toEqual(new Set());
    expect(parseIdSet('{"a":1}')).toEqual(new Set());
    expect(parseIdSet("null")).toEqual(new Set());
  });

  it("keeps only string entries", () => {
    expect(parseIdSet('["promotion",42,null,{"id":"x"}]')).toEqual(new Set(["promotion"]));
  });
});

describe("serializeIdSet", () => {
  it("writes a stable, order-independent value", () => {
    expect(serializeIdSet(new Set(["b", "a"]))).toBe(
      serializeIdSet(new Set(["a", "b"])),
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEffectiveTheme } from "./preferences.ts";

describe("preferences theme resolver", () => {
  it("resolves explicit light/dark preferences and system scheme", () => {
    assert.equal(resolveEffectiveTheme("light", "dark"), "light");
    assert.equal(resolveEffectiveTheme("dark", "light"), "dark");
    assert.equal(resolveEffectiveTheme("system", "dark"), "dark");
    assert.equal(resolveEffectiveTheme("system", null), "light");
  });
});

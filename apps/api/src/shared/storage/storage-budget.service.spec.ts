import { describe, expect, it } from "vitest";
import {
  CONFIG_CATALOG,
  type ConfigEntryDef,
} from "../../common/config/config.catalog";

const catalog: Readonly<Record<string, ConfigEntryDef<unknown>>> =
  CONFIG_CATALOG;

describe("trial storage limits", () => {
  it.each([
    ["storage.budget.max_stored_bytes", 524288000],
    ["storage.budget.max_class_a", 10000],
    ["storage.budget.max_class_b", 100000],
    ["storage.budget.max_transfer_bytes", 1073741824],
  ])("pins %s without a free reset or unlimited value", (key, maximum) => {
    const entry = catalog[key];
    expect(entry?.default).toBe(maximum);
    expect(entry?.schema.safeParse(0).success).toBe(false);
    expect(entry?.schema.safeParse(-1).success).toBe(false);
    expect(entry?.schema.safeParse(Number(maximum) + 1).success).toBe(false);
    expect(entry?.schema.safeParse(1).success).toBe(true);
  });
});

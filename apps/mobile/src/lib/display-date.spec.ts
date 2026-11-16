import assert from "node:assert/strict";
import { it } from "node:test";
import { formatDisplayDate } from "./display-date.ts";

it("formats both sides of Istanbul midnight in the app language", () => {
  const before = "2026-10-31T20:59:59.999Z";
  const midnight = "2026-10-31T21:00:00.000Z";

  assert.equal(formatDisplayDate(before, "tr"), "31 Ekim 2026");
  assert.equal(formatDisplayDate(midnight, "tr"), "1 Kasım 2026");
  assert.equal(formatDisplayDate(before, "en"), "31 October 2026");
  assert.equal(formatDisplayDate(midnight, "en"), "1 November 2026");
});

it("preserves the server's UTC editorial calendar date", () => {
  assert.equal(formatDisplayDate("2026-10-31T21:00:00Z", "tr", "UTC"), "31 Ekim 2026");
});

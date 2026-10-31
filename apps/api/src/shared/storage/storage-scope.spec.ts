import { describe, expect, it } from "vitest";
import { storageScopeFingerprint } from "./storage-scope";
import type { StorageScope } from "./storage-budget.types";

const scope: StorageScope = { accountId: "fixture-account", publicBucket: "fixture-public", privateBucket: "fixture-private", jurisdiction: "eu" };
describe("durable storage scope identity", () => {
  it.each(["accountId", "publicBucket", "privateBucket"] as const)("does not permit changing %s without rebinding the scope", (field) => {
    expect(storageScopeFingerprint({ ...scope, [field]: "different" })).not.toBe(storageScopeFingerprint(scope));
  });
  it("does not refill usage when credentials or API URL change", () => {
    const rotated = { ...scope, accessKeyId: "rotated", gatewayUrl: "https://other.example.invalid" };
    expect(storageScopeFingerprint(rotated)).toBe(storageScopeFingerprint(scope));
  });
});

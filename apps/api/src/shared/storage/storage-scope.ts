import { createHash } from "node:crypto";
import type { StorageScope } from "./storage-budget.types";

export function storageScopeFingerprint(scope: StorageScope): string {
  return createHash("sha256").update(JSON.stringify([
    "storage-budget-v1", scope.accountId, scope.publicBucket, scope.privateBucket, scope.jurisdiction,
  ])).digest("hex");
}

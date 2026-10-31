import { DomainError } from "../../common/errors/domain-error";
import { ErrorCode } from "../../common/errors/error-code";
import type { StorageBudgetService } from "./storage-budget.service";
import type { StorageScope } from "./storage-budget.types";

export type InitializationBudget = Pick<StorageBudgetService, "beginInitialization" | "recordInitializationProbe" | "markReady" | "blockInitialization">;
export interface BucketProbeResult { statusCode?: number; keyCount?: number; objectCount: number; truncated: boolean }

export async function initializeTrialStorage(
  budget: InitializationBudget, scope: StorageScope, probe: (bucket: string) => Promise<BucketProbeResult>,
  onReserved?: (id: string) => void,
): Promise<string> {
  const initialization = await budget.beginInitialization(scope);
  try {
    onReserved?.(initialization.id);
    const buckets = [scope.publicBucket, scope.privateBucket];
    for (const [index, reservation] of initialization.probeReservations.entries()) {
      let result: BucketProbeResult;
      try { result = await probe(buckets[index]!); }
      catch {
        await budget.recordInitializationProbe(reservation, "uncertain");
        throw unavailable();
      }
      await budget.recordInitializationProbe(reservation, "succeeded");
      if (result.statusCode !== 200 || result.keyCount !== 0 || result.objectCount !== 0 || result.truncated) throw unavailable();
    }
    await budget.markReady(initialization.id);
    return initialization.id;
  } catch {
    await budget.blockInitialization(initialization.id).catch(() => { throw unavailable(); });
    throw unavailable();
  }
}

function unavailable() { return new DomainError(ErrorCode.STORAGE_TEMPORARILY_UNAVAILABLE, 503); }

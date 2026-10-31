import { describe, expect, it, vi } from "vitest";
import { initializeTrialStorage, type BucketProbeResult, type InitializationBudget } from "./storage-budget-initializer";
import type { StorageReservation, StorageScope } from "./storage-budget.types";

const scope: StorageScope = {accountId: "fixture-account",publicBucket: "fixture-public", privateBucket: "fixture-private",jurisdiction: "eu"};
const empty = { statusCode: 200, keyCount: 0, objectCount: 0, truncated: false };
function fixture() {
  const probeReservations: [StorageReservation, StorageReservation] = [
    {id: "first",kind: "initialization",reservedBytes: 0,reservedTransferBytes: 0,classA: 1,classB: 0},
    {id: "second",kind: "initialization",reservedBytes: 0,reservedTransferBytes: 0,classA: 1,classB: 0},
  ];
  const budget = {beginInitialization: vi.fn(async (_scope: StorageScope) => ({id: "attempt",probeReservations})),
    recordInitializationProbe: vi.fn(async (_reservation: StorageReservation, _outcome: "succeeded" | "uncertain") => undefined),
    markReady: vi.fn(async (_id: string) => undefined),blockInitialization: vi.fn(async (_id: string) => undefined)} satisfies InitializationBudget;
  return { budget, probe: vi.fn(async (_bucket: string): Promise<BucketProbeResult> => empty) };
}
describe("trusted empty-bucket initialization", () => {
  it("reserves before its two probes and marks ready only after explicit empty results", async () => {
    const f = fixture();
    await expect(initializeTrialStorage(f.budget, scope, f.probe)).resolves.toBe("attempt");
    expect(f.budget.beginInitialization.mock.invocationCallOrder[0]).toBeLessThan(f.probe.mock.invocationCallOrder[0]!);
    expect(f.probe.mock.calls).toEqual([["fixture-public"],["fixture-private"]]);
    expect(f.budget.recordInitializationProbe).toHaveBeenCalledTimes(2);
    expect(f.budget.markReady.mock.invocationCallOrder[0]).toBeGreaterThan(f.budget.recordInitializationProbe.mock.invocationCallOrder[1]!);
  });
  it.each([
    {...empty,keyCount: undefined}, {...empty,objectCount: 1}, {...empty,keyCount: 1},
    {...empty,truncated: true}, {...empty,statusCode: 403},
  ])("does not treat ambiguous/nonempty provider data as an empty bucket", async result => {
    const f = fixture();
    f.probe.mockResolvedValue(result);
    await expect(initializeTrialStorage(f.budget, scope, f.probe)).rejects.toMatchObject({code: "STORAGE_TEMPORARILY_UNAVAILABLE"});
    expect(f.budget.markReady).not.toHaveBeenCalled();
    expect(f.budget.blockInitialization).toHaveBeenCalledWith("attempt");
    expect(f.probe).toHaveBeenCalledTimes(1);
  });
  it("does not retry a failed provider call or print its private error", async () => {
    const f = fixture();
    f.probe.mockRejectedValue(new Error("private-provider-credentials"));
    await expect(initializeTrialStorage(f.budget, scope, f.probe)).rejects.toMatchObject({message: "STORAGE_TEMPORARILY_UNAVAILABLE"});
    expect(f.probe).toHaveBeenCalledTimes(1);
    expect(f.budget.recordInitializationProbe).toHaveBeenCalledWith(expect.objectContaining({id: "first"}), "uncertain");
    expect(f.budget.blockInitialization).toHaveBeenCalledWith("attempt");
  });
});

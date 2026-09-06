import { describe, expect, it, vi } from "vitest";
import { AiUsageRepository } from "./ai-usage.repository";

function setup() {
  const execute = vi.fn(async () => undefined);
  const values = vi.fn(async () => undefined);
  const where = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  const deleteRow = vi.fn(() => ({ where }));
  const tx = { execute, insert, delete: deleteRow };
  const db = { transaction: vi.fn(async (work: (value: typeof tx) => unknown) => work(tx)) };
  return { repo: new AiUsageRepository(db as never), execute, values, where, insert, deleteRow };
}

const usage = {
  userId: "user-id",
  model: "model",
  feature: "chat",
  promptTokens: 10,
  completionTokens: 5,
  costMicros: 100,
};

describe("AiUsageRepository budget settlement", () => {
  it("takes the budget lock before atomically writing usage and deleting its hold", async () => {
    const { repo, execute, values, where } = setup();

    await repo.append({ ...usage, budgetReservationId: "reservation-id" });

    // First execute is SET LOCAL from withServiceContext; second is the monthly advisory lock.
    expect(execute).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenCalledWith(usage);
    expect(where).toHaveBeenCalledOnce();
    expect(execute.mock.invocationCallOrder[1]).toBeLessThan(values.mock.invocationCallOrder[0]!);
    expect(values.mock.invocationCallOrder[0]).toBeLessThan(where.mock.invocationCallOrder[0]!);
  });

  it("does not add a budget lock when the cap is disabled and there is no hold", async () => {
    const { repo, execute, deleteRow } = setup();

    await repo.append(usage);

    expect(execute).toHaveBeenCalledOnce();
    expect(deleteRow).not.toHaveBeenCalled();
  });
});

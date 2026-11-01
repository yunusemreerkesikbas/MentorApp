import { describe, expect, it, vi } from "vitest";
import { WeeklyRecapRegistry } from "./weekly-recap.registry";

describe("Wrapped public gate registration", () => {
  it("fails closed if enforcement is enabled without its owning policy", async () => {
    const registry = new WeeklyRecapRegistry({ get: vi.fn(async () => true) } as never);
    await expect(registry.read("user", "exam")).rejects.toMatchObject({ code: "AI_DISABLED", httpStatus: 503 });
  });
  it("preserves the old path when rollout is off", async () => {
    const registry = new WeeklyRecapRegistry({ get: vi.fn(async () => false) } as never);
    await expect(registry.read("user", "exam")).resolves.toBeNull();
  });
});

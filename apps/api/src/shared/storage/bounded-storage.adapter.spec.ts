import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ConfigRegistryService } from "../../common/config/config-registry.service";
import { DomainError } from "../../common/errors/domain-error";
import type { ObjectStoragePort } from "../ports/storage.port";
import { BoundedStorageAdapter } from "./bounded-storage.adapter";
import { StorageBudgetService } from "./storage-budget.service";
import type { StorageBudgetRepository } from "./storage-budget.repository";
import type { StorageOperation, StorageUsageLimits } from "./storage-budget.types";

const key = () => `notebook/${randomUUID()}/${randomUUID()}.png`;
const unavailable = { code: "STORAGE_TEMPORARILY_UNAVAILABLE", httpStatus: 503 };
function fixture() {
  const raw = { putObject: vi.fn(async () => undefined), createReadUrl: vi.fn(async () => "https://r2.invalid/private"),
    getPublicUrl: vi.fn(() => "https://r2.invalid/public"), readObject: vi.fn(async () => Buffer.from("image")),
    deleteObject: vi.fn(async () => undefined), copyObject: vi.fn(async () => undefined), listObjects: vi.fn(async () => []) } satisfies ObjectStoragePort;
  const repository = { reserve: vi.fn(async (_operation: StorageOperation, _limits: StorageUsageLimits) => ({ id: randomUUID(), kind: "read" as const, reservedBytes: 0, classA: 0, classB: 2 })),
    settle: vi.fn(async (_id: string, _outcome: "succeeded" | "uncertain") => undefined) };
  const config = { get: vi.fn(async (name: string) => name.endsWith("transfer_bytes") ? 1073741824 : name.endsWith("stored_bytes") ? 524288000 : name.endsWith("class_a") ? 10000 : 100000) };
  const budget = new StorageBudgetService(repository as unknown as StorageBudgetRepository, config as unknown as ConfigRegistryService);
  return { raw, repository, config, adapter: new BoundedStorageAdapter(raw, budget) };
}

describe("bounded raw object storage", () => {
  it("refuses before raw access when the global budget is full", async () => {
    const f = fixture();
    f.repository.reserve.mockRejectedValue(new DomainError("STORAGE_TEMPORARILY_UNAVAILABLE", 503));
    await expect(f.adapter.readObject(key(), 5242880)).rejects.toMatchObject(unavailable);
    expect(f.raw.readObject).not.toHaveBeenCalled();
  });
  it("reserves before each operation and settles successful attempts", async () => {
    const f = fixture();
    const source = key();
    await f.adapter.putObject(source, Buffer.from("image"), "image/png");
    await f.adapter.readObject(source, 5242880);
    await f.adapter.copyObject(source, key());
    await f.adapter.listObjects("notebook/", 100);
    await f.adapter.deleteObject(source);
    expect(f.repository.reserve.mock.calls.map(call => call[0])).toEqual([
      { kind: "put", key: source, bytes: 5, contentType: "image/png" },
      { kind: "read", key: source, maxBytes: 5242880 },
      expect.objectContaining({ kind: "copy", sourceKey: source }),
      { kind: "list", prefix: "notebook/", limit: 100 }, { kind: "delete", key: source },
    ]);
    expect(f.repository.settle).toHaveBeenCalledTimes(5);
    expect(f.repository.settle.mock.calls.every(call => call[1] === "succeeded")).toBe(true);
    expect(f.repository.reserve.mock.invocationCallOrder[0]).toBeLessThan(f.raw.putObject.mock.invocationCallOrder[0]!);
  });
  it("retains uncertainty when the backend operation fails", async () => {
    const f = fixture();
    f.raw.putObject.mockRejectedValue(new Error("private-provider-error"));
    await expect(f.adapter.putObject(key(), Buffer.from("image"), "image/png")).rejects.toMatchObject(unavailable);
    expect(f.repository.settle).toHaveBeenCalledWith(expect.any(String), "uncertain");
  });
  it("never repeats a successful side effect when settlement fails", async () => {
    const f = fixture();
    f.repository.settle.mockRejectedValue(new Error("database-private-error"));
    await expect(f.adapter.putObject(key(), Buffer.from("image"), "image/png")).rejects.toMatchObject(unavailable);
    expect(f.raw.putObject).toHaveBeenCalledTimes(1);
    expect(f.repository.settle).toHaveBeenCalledTimes(1);
  });
  it("cannot issue a direct private or public provider URL", async () => {
    const f = fixture();
    await expect(f.adapter.createReadUrl(key(), 300)).rejects.toMatchObject(unavailable);
    expect(() => f.adapter.getPublicUrl(key())).toThrow();
    expect(f.raw.createReadUrl).not.toHaveBeenCalled();
    expect(f.raw.getPublicUrl).not.toHaveBeenCalled();
  });
  it.each(["unknown/file.png", "notebook/../file.png", "notebook/%2e%2e/file.png", "notebook/a\\b/file.png"])("rejects invalid keys before reservation or backend access: %s", async (invalid) => {
    const f = fixture();
    await expect(f.adapter.readObject(invalid)).rejects.toMatchObject(unavailable);
    expect(f.repository.reserve).not.toHaveBeenCalled();
    expect(f.raw.readObject).not.toHaveBeenCalled();
  });
});

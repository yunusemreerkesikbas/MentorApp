import { describe, expect, it, vi } from "vitest";
import { FakeStorageController } from "./fake-storage.controller";

describe("FakeStorageController", () => {
  it("does not expose a private key through the public development endpoint", async () => {
    const fake = { readObject: vi.fn().mockResolvedValue(Buffer.from("private")) };
    const config = { get: vi.fn((key: string) => key === "STORAGE_PROVIDER" ? "fake" : "test") };
    const response = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    const controller = new FakeStorageController(fake as never, config as never);

    await controller.fakeObject("notebook/user-id/photo.png", response as never);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(fake.readObject).not.toHaveBeenCalled();
  });
});

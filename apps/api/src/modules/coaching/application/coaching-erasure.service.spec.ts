import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoachingErasureService } from "./coaching-erasure.service";

const USER = "11111111-1111-4111-8111-111111111111";

describe("CoachingErasureService", () => {
  let eraseUserData: ReturnType<typeof vi.fn>;
  let deleteObject: ReturnType<typeof vi.fn>;
  let service: CoachingErasureService;

  beforeEach(() => {
    eraseUserData = vi.fn(async () => ({
      photoStorageKeys: ["photos/a.jpg", "photos/b.jpg"],
    }));
    deleteObject = vi.fn(async () => undefined);
    service = new CoachingErasureService(
      { eraseUserData } as never,
      { deleteObject } as never,
    );
  });

  it("scrubs the DB and deletes every uploaded photo object", async () => {
    await service.eraseUserData(USER);

    expect(eraseUserData).toHaveBeenCalledWith(USER);
    expect(deleteObject).toHaveBeenCalledWith("photos/a.jpg");
    expect(deleteObject).toHaveBeenCalledWith("photos/b.jpg");
  });

  it("still succeeds when storage deletion fails (best-effort — the DB scrub already landed)", async () => {
    deleteObject.mockRejectedValue(new Error("storage down"));

    await expect(service.eraseUserData(USER)).resolves.toBeUndefined();
  });

  it("propagates a DB scrub failure", async () => {
    eraseUserData.mockRejectedValue(new Error("db down"));

    await expect(service.eraseUserData(USER)).rejects.toThrow("db down");
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("is a no-op for a user with no photos", async () => {
    eraseUserData.mockResolvedValue({ photoStorageKeys: [] });

    await service.eraseUserData(USER);

    expect(deleteObject).not.toHaveBeenCalled();
  });
});

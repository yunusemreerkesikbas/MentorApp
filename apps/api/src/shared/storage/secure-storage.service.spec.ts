import { describe, expect, it, vi } from "vitest";
import { SecureStorageService } from "./secure-storage.service";

describe("SecureStorageService private reads", () => {
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("only mints a five-minute read URL for the owner namespace", async () => {
    const createReadUrl = vi.fn().mockResolvedValue("signed");
    const storage = new SecureStorageService({ createReadUrl } as never, {} as never, {} as never);
    await expect(storage.getPrivateUrl(`notebook/${owner}/photo.jpg`, owner)).resolves.toBe("signed");
    expect(createReadUrl).toHaveBeenCalledWith(`notebook/${owner}/photo.jpg`, 300);
    await expect(storage.getPrivateUrl(`notebook/${owner}/photo.jpg`, other)).rejects.toBeDefined();
    await expect(storage.getPrivateUrl(`avatars/${owner}/photo.jpg`, owner)).rejects.toBeDefined();
  });
});

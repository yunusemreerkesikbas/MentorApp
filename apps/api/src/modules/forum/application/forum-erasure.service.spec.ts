import { describe, expect, it, vi } from "vitest";
import { ForumErasureService } from "./forum-erasure.service";

const USER = "11111111-1111-4111-8111-111111111111";

describe("ForumErasureService", () => {
  it("scrubs the DB then deletes each attachment object", async () => {
    const eraseUserData = vi.fn(async () => ({ attachmentStorageKeys: ["forum/a.png", "forum/b.png"] }));
    const deleteObject = vi.fn(async () => undefined);
    const service = new ForumErasureService({ eraseUserData } as never, { deleteObject } as never);

    await service.eraseUserData(USER);

    expect(eraseUserData).toHaveBeenCalledWith(USER);
    expect(deleteObject).toHaveBeenCalledWith("forum/a.png");
    expect(deleteObject).toHaveBeenCalledWith("forum/b.png");
  });

  it("completes even when storage deletes fail — the committed DB scrub must stand", async () => {
    const eraseUserData = vi.fn(async () => ({ attachmentStorageKeys: ["forum/a.png"] }));
    const deleteObject = vi.fn(async () => {
      throw new Error("storage down");
    });
    const service = new ForumErasureService({ eraseUserData } as never, { deleteObject } as never);

    await expect(service.eraseUserData(USER)).resolves.toBeUndefined();
  });
});

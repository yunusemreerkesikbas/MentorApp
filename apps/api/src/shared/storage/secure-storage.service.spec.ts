import { describe, expect, it, vi } from "vitest";
import { SecureStorageService } from "./secure-storage.service";
import { ConfigService } from "@nestjs/config";
import { MediaReadGrantService } from "./media-read-grant.service";

describe("SecureStorageService private reads", () => {
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const actor={userId:owner,sessionId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"};

  it("only mints a five-minute read URL for the owner namespace", async () => {
    const createReadUrl = vi.fn().mockResolvedValue("signed");
    const storage = new SecureStorageService({ createReadUrl } as never, {} as never, {} as never,new ConfigService({STORAGE_ACCESS_MODE:"direct"}),{} as never,{} as never);
    await expect(storage.getPrivateUrl(`notebook/${owner}/photo.jpg`, actor)).resolves.toBe("signed");
    expect(createReadUrl).toHaveBeenCalledWith(`notebook/${owner}/photo.jpg`, 300);
    await expect(storage.getPrivateUrl(`notebook/${owner}/photo.jpg`, {...actor,userId:other})).rejects.toBeDefined();
    await expect(storage.getPrivateUrl(`avatars/${owner}/photo.jpg`, actor)).rejects.toBeDefined();
  });
  it("mints bounded gateway URLs without invoking a provider or budget operation",async () => {
    const config=new ConfigService({STORAGE_ACCESS_MODE:"bounded",MEDIA_READ_SECRET:"test-media-0000000000000000000000000000",R2_PUBLIC_BASE_URL:"https://api.test/v1/storage/media/public"});
    const raw={createReadUrl:vi.fn(),getPublicUrl:vi.fn()}; const grants=new MediaReadGrantService(config);
    const storage=new SecureStorageService(raw as never,{} as never,{} as never,config,grants,{get:vi.fn().mockResolvedValue(300)} as never);
    const url=await storage.getPrivateUrl(`notebook/${owner}/photo.jpg`,actor);
    expect(grants.verify(new URL(url).searchParams.get("grant")!)).toMatchObject(actor);
    expect(storage.getPublicUrl(`avatars/${owner}/photo.jpg`)).toContain("/v1/storage/media/public/avatars/");
    expect(raw.createReadUrl).not.toHaveBeenCalled(); expect(raw.getPublicUrl).not.toHaveBeenCalled();
  });
});

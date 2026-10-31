import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DomainError, UnauthorizedError } from "../../common/errors/domain-error";
import { MediaReadGrantService } from "./media-read-grant.service";
import { MediaReadService } from "./media-read.service";

function fixture() {
  const actor = {userId:randomUUID(),sessionId:randomUUID()};
  const key = `notebook/${actor.userId}/${randomUUID()}.png`;
  const config = new ConfigService({STORAGE_ACCESS_MODE:"bounded",MEDIA_READ_SECRET:"test-media-0000000000000000000000000"});
  const grants = new MediaReadGrantService(config);
  const tokens = {validateSession:vi.fn().mockResolvedValue({id:actor.userId,sessionId:actor.sessionId})};
  const repository = {manifest:vi.fn().mockImplementation(async (value: string) => ({key:value,bytes:3,contentType:"image/png",state:"confirmed"}))};
  const raw = {readObject:vi.fn().mockResolvedValue(Buffer.from("png"))};
  const media = new MediaReadService(config,grants,tokens as never,repository as never,raw as never);
  return {actor,key,grants,tokens,repository,raw,media,config};
}
describe("bounded media reads", () => {
  it("validates the exact session and manifest before the guarded provider", async () => {
    const f = fixture(); const token = f.grants.issue(f.key,f.actor,300);
    await expect(f.media.readPrivate(token)).resolves.toEqual({bytes:Buffer.from("png"),contentType:"image/png"});
    expect(f.tokens.validateSession).toHaveBeenCalledWith(f.actor.sessionId,f.actor.userId);
    expect(f.raw.readObject).toHaveBeenCalledWith(f.key,3);
    expect(f.tokens.validateSession.mock.invocationCallOrder[0]).toBeLessThan(f.raw.readObject.mock.invocationCallOrder[0]!);
  });
  it("refuses a revoked session without consulting the provider", async () => {
    const f = fixture(); f.tokens.validateSession.mockRejectedValue(new UnauthorizedError());
    await expect(f.media.readPrivate(f.grants.issue(f.key,f.actor,300))).rejects.toMatchObject({httpStatus:401});
    expect(f.raw.readObject).not.toHaveBeenCalled();
  });
  it.each(["notebook/a/photo.png","unknown/photo.png","avatars/a/../photo.png","avatars/a/%2e.png"])("rejects an unsafe public key %s",async key => {
    const f=fixture(); await expect(f.media.readPublic(key)).rejects.toBeDefined(); expect(f.raw.readObject).not.toHaveBeenCalled();
  });
  it("allows public avatars and authorizes HEAD without a paid provider read", async () => {
    const f=fixture(); const key=`avatars/${f.actor.userId}/${randomUUID()}.png`;
    await expect(f.media.headPublic(key)).resolves.toMatchObject({contentType:"image/png",size:3});
    await expect(f.media.headPrivate(f.grants.issue(f.key,f.actor,300))).resolves.toMatchObject({contentType:"image/png",size:3});
    expect(f.raw.readObject).not.toHaveBeenCalled();
    await expect(f.media.readPublic(key)).resolves.toMatchObject({contentType:"image/png"});
  });
  it.each([undefined,{state:"uncertain"},{contentType:"text/html"}])("refuses missing or unsafe manifests before raw access",async change => {
    const f=fixture(); f.repository.manifest.mockResolvedValue(change && {key:f.key,bytes:3,contentType:"image/png",state:"confirmed",...change});
    await expect(f.media.readPrivate(f.grants.issue(f.key,f.actor,300))).rejects.toBeDefined();
    expect(f.raw.readObject).not.toHaveBeenCalled();
  });
  it("preserves temporary-media denial without returning provider details",async () => {
    const f=fixture(); f.raw.readObject.mockRejectedValue(new DomainError("STORAGE_TEMPORARILY_UNAVAILABLE",503));
    await expect(f.media.readPrivate(f.grants.issue(f.key,f.actor,300))).rejects.toMatchObject({httpStatus:503});
  });
  it("closes this gateway in legacy direct mode",async () => {
    const f=fixture(); f.config.set("STORAGE_ACCESS_MODE","direct");
    await expect(f.media.readPublic(`avatars/${f.actor.userId}/${randomUUID()}.png`)).rejects.toMatchObject({httpStatus:404});
    expect(f.raw.readObject).not.toHaveBeenCalled();
  });
});

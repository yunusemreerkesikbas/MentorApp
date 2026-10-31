import { createHmac, randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONFIG_CATALOG } from "../../common/config/config.catalog";
import { MediaReadGrantService } from "./media-read-grant.service";

const secret = "test-media-read-secret-0000000000000000000";
const actor = {userId:randomUUID(),sessionId:randomUUID()};
const key = `notebook/${actor.userId}/${randomUUID()}.png`;
const service = () => new MediaReadGrantService(new ConfigService({MEDIA_READ_SECRET:secret,R2_PUBLIC_BASE_URL:"https://api.test/v1/storage/media/public"}));
const sign = (payload: unknown) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256",secret).update(encoded).digest("base64url")}`;
};
afterEach(() => vi.useRealTimers());
describe("private media grants", () => {
  it("binds a short-lived versioned grant to the exact object, owner and session", () => {
    const grants = service();
    expect(grants.verify(grants.issue(key,actor,300))).toEqual({...actor,key,expiresAt:Math.floor(Date.now()/1000)+300});
  });
  it("refuses a changed signature, malformed token and expired grant", () => {
    vi.useFakeTimers();
    const grants = service(); const token = grants.issue(key,actor,30);
    expect(() => grants.verify(token+"x")).toThrow();
    expect(() => grants.verify("x".repeat(4096))).toThrow();
    vi.advanceTimersByTime(30000);
    expect(() => grants.verify(token)).toThrow();
  });
  it.each([
    {v:2}, {extra:"untrusted"}, {key:`notebook/${randomUUID()}/${randomUUID()}.png`},
    {key:`avatars/${actor.userId}/photo.png`}, {key:`notebook/${actor.userId}/../photo.png`},
    {sessionId:"not-a-session"}, {expiresAt:Math.floor(Date.now()/1000)+301},
  ])("rejects invalid signed claims %j", change => {
    expect(() => service().verify(sign({v:1,...actor,key,expiresAt:Math.floor(Date.now()/1000)+60,...change}))).toThrow();
  });
  it("requires a valid owner/session and the bounded TTL when issuing", () => {
    expect(() => service().issue(key,{...actor,userId:randomUUID()},300)).toThrow();
    expect(() => service().issue(key,actor,301)).toThrow();
    expect(() => service().issue(key,actor,0)).toThrow();
  });
  it("constructs API URLs without provider access and forbids private public URLs", () => {
    const grants = service(); const token = grants.issue(key,actor,300);
    expect(grants.privateUrl(token)).toBe(`https://api.test/v1/storage/media/private?grant=${token}`);
    expect(grants.publicUrl(`avatars/${actor.userId}/photo.png`)).toBe(`https://api.test/v1/storage/media/public/avatars/${actor.userId}/photo.png`);
    expect(() => grants.publicUrl(key)).toThrow();
  });
  it("pins a positive five-minute registry ceiling", () => {
    const entry = CONFIG_CATALOG["storage.media.read_seconds"];
    expect(entry?.default).toBe(300);
    expect(entry?.schema.safeParse(29).success).toBe(false);
    expect(entry?.schema.safeParse(301).success).toBe(false);
  });
});

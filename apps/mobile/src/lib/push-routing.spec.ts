import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mobilePushRegisterSchema,
  mobilePushUnregisterSchema,
} from "@mentor/validation";
import {
  extractPushLinkUrl,
  isExpoGoRuntime,
  resolveMobilePushPlatform,
  resolvePushNotificationDestination,
} from "./push-routing.ts";

describe("push-routing helpers", () => {
  it("extracts and resolves internal tab and stack destinations", () => {
    assert.equal(extractPushLinkUrl(null), null);
    assert.equal(extractPushLinkUrl({}), null);
    assert.equal(extractPushLinkUrl({ url: "  /plan  " }), "/plan");

    assert.deepEqual(
      resolvePushNotificationDestination({ url: "/plan?date=2026-11-21" }, true),
      { pathname: "/(app)/(tabs)/plan" },
    );

    assert.deepEqual(
      resolvePushNotificationDestination(
        { url: "/bilgi/kpss-lisans-p3-net-hesaplama" },
        true,
      ),
      {
        pathname: "/(app)/knowledge",
        params: { slug: "kpss-lisans-p3-net-hesaplama" },
      },
    );
  });

  it("blocks out-of-scope community and unsafe external destinations", () => {
    assert.equal(
      resolvePushNotificationDestination({ url: "/community/member/demo" }, true),
      null,
    );
    assert.deepEqual(
      resolvePushNotificationDestination({ url: "/community/member/demo" }, false),
      { pathname: "/(app)/community-member", params: { username: "demo" } },
    );
    assert.equal(
      resolvePushNotificationDestination({ url: "https://evil.example.com" }, true),
      null,
    );
  });

  it("detects Expo Go runtime and mobile platforms", () => {
    assert.equal(isExpoGoRuntime("expo", undefined), true);
    assert.equal(isExpoGoRuntime(undefined, "storeClient"), true);
    assert.equal(isExpoGoRuntime(undefined, "standalone"), false);
    assert.equal(isExpoGoRuntime(undefined, "bare"), false);

    assert.equal(resolveMobilePushPlatform("android"), "android");
    assert.equal(resolveMobilePushPlatform("ios"), "ios");
    assert.equal(resolveMobilePushPlatform("web"), null);
  });

  it("validates mobile push token payloads against shared Zod schemas", () => {
    const valid = "ExponentPushToken[abcdefghijklmnopqrstuv]";
    assert.equal(
      mobilePushRegisterSchema.safeParse({ token: valid, platform: "android" }).success,
      true,
    );
    assert.equal(
      mobilePushUnregisterSchema.safeParse({ token: "ExpoPushToken[12345678]" }).success,
      true,
    );
    assert.equal(
      mobilePushRegisterSchema.safeParse({ token: "https://evil.example", platform: "android" }).success,
      false,
    );
    assert.equal(
      mobilePushRegisterSchema.safeParse({ token: valid, platform: "web" }).success,
      false,
    );
  });
});

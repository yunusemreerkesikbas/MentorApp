import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./web-push";

describe("urlBase64ToUint8Array", () => {
  it("decodes the URL-safe alphabet and restores the padding a VAPID key drops", () => {
    // These bytes encode to "+/+/AQ==" in standard base64, which a VAPID key carries as "-_-_AQ".
    const bytes = [0xfb, 0xff, 0xbf, 0x01];

    expect(Array.from(urlBase64ToUint8Array("-_-_AQ"))).toEqual(bytes);
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { mobileMediaImageSource } from "./media-image-source.ts";

const api = "https://api.example";
test("sends private grants to the configured API only", () => {
  for (const prefix of ["", "https://media.example", "https://other.example"]) {
    const source = mobileMediaImageSource(`${prefix}/v1/storage/media/private?grant=example&redirect=elsewhere`, api, "access");
    assert.deepEqual(source, {
      uri: "https://api.example/v1/storage/media/mobile-private?grant=example",
      headers: { Authorization: "Bearer access", "X-Client-Platform": "mobile" },
    });
  }
});
test("keeps credentials off direct and public image requests", () => {
  for (const url of ["https://cdn.example/image.png?signature=abc", "file:///image.png", "/v1/storage/media/public/avatars/a"]) {
    assert.deepEqual(mobileMediaImageSource(url, api, "access"), { uri: new URL(url, api).href });
  }
  assert.equal(mobileMediaImageSource("/v1/storage/media/private?grant=a", api, null), undefined);
  assert.equal(mobileMediaImageSource("/v1/storage/media/private", api, "access"), undefined);
});

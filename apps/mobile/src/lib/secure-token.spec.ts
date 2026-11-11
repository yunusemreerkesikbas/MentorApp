import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REFRESH_TOKEN_STORAGE_KEY,
  createSecureTokenStore,
  getCachedRefreshToken,
} from "./secure-token.ts";

describe("secure token store adapter", () => {
  it("persists, caches in memory for sync header reads, and clears refresh token", async () => {
    const map = new Map<string, string>();
    const store = createSecureTokenStore({
      getItemAsync: async (k) => map.get(k) ?? null,
      setItemAsync: async (k, v) => {
        map.set(k, v);
      },
      deleteItemAsync: async (k) => {
        map.delete(k);
      },
    });

    assert.equal(await store.getRefreshToken(), null);
    await store.setRefreshToken("rt-123");
    assert.equal(map.get(REFRESH_TOKEN_STORAGE_KEY), "rt-123");
    assert.equal(getCachedRefreshToken(), "rt-123");

    await store.clearRefreshToken();
    assert.equal(getCachedRefreshToken(), null);
    assert.equal(await store.getRefreshToken(), null);
  });
});

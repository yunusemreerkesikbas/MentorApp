import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMobileEnv } from "./env.ts";

describe("mobile env resolver", () => {
  it("falls back to localhost:3001 in development and strips trailing slash", () => {
    assert.deepEqual(resolveMobileEnv({}), {
      EXPO_PUBLIC_API_URL: "http://localhost:3001",
      APP_ENV: "development",
    });

    assert.deepEqual(
      resolveMobileEnv({
        EXPO_PUBLIC_API_URL: "https://api.puhukoc.com/",
        APP_ENV: "production",
      }),
      {
        EXPO_PUBLIC_API_URL: "https://api.puhukoc.com",
        APP_ENV: "production",
      },
    );
  });
});

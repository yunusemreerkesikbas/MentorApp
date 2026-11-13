import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiClientError, configureApiClient, http } from "../dist/http.js";

let token: string | null;
let sent: (string | null)[];
let replies: Response[];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const expired = () => json(401, { code: "AUTH_TOKEN_EXPIRED", message: "expired" });

beforeEach(() => {
  token = "old";
  sent = [];
  replies = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push(new Headers(init.headers).get("authorization"));
    return replies.shift()!;
  }) as typeof fetch;
});

function configure(refreshAccessToken?: () => Promise<boolean>) {
  configureApiClient({ baseUrl: "", getAccessToken: () => token, refreshAccessToken });
}

describe("http on an expired access token", () => {
  it("refreshes once and retries with the new token", async () => {
    let refreshes = 0;
    configure(async () => {
      refreshes += 1;
      token = "new";
      return true;
    });
    replies = [expired(), json(200, { ok: true })];
    assert.deepEqual(await http("/v1/x"), { ok: true });
    assert.equal(refreshes, 1);
    assert.deepEqual(sent, ["Bearer old", "Bearer new"]);
  });

  it("retries without a refresh when the token already changed meanwhile", async () => {
    let refreshes = 0;
    configure(async () => {
      refreshes += 1;
      return true;
    });
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent.push(new Headers(init.headers).get("authorization"));
      if (sent.length === 1) {
        token = "new"; // another request's refresh landed while this one was in flight
        return expired();
      }
      return json(200, { ok: true });
    }) as typeof fetch;
    assert.deepEqual(await http("/v1/x"), { ok: true });
    assert.equal(refreshes, 0);
    assert.deepEqual(sent, ["Bearer old", "Bearer new"]);
  });

  it("gives the 401 back when the refresh fails", async () => {
    configure(async () => false);
    replies = [expired()];
    await assert.rejects(http("/v1/x"), (e: unknown) => e instanceof ApiClientError && e.status === 401);
    assert.equal(sent.length, 1);
  });

  it("leaves other 401s and clients without a refresh hook alone", async () => {
    let refreshes = 0;
    configure(async () => {
      refreshes += 1;
      return true;
    });
    replies = [json(401, { code: "UNAUTHORIZED", message: "no" })];
    await assert.rejects(http("/v1/x"));
    configure();
    replies = [expired()];
    await assert.rejects(http("/v1/x"));
    assert.equal(refreshes, 0);
    assert.equal(sent.length, 2);
  });
});

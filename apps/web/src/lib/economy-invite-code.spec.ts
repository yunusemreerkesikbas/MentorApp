import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "@mentor/api-client";
import { fetchInviteCode, forgetInviteCode, peekInviteCode } from "./economy";

vi.mock("@mentor/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mentor/api-client")>();
  return { ...actual, http: vi.fn() };
});

const request = vi.mocked(http);

function view(code: string) {
  return { code, rewardCoin: 20, joined: [], joinedCount: 0, convertedCount: 0, redeemed: null, canRedeem: true };
}

afterEach(() => {
  forgetInviteCode();
  request.mockReset();
});

describe("peekInviteCode", () => {
  it("is null until a code was fetched", () => {
    expect(peekInviteCode()).toBeNull();
  });

  it("returns the code of the last successful fetch, synchronously", async () => {
    request.mockResolvedValueOnce(view("PUHU-AAAA2345"));
    await fetchInviteCode();
    expect(peekInviteCode()).toBe("PUHU-AAAA2345");

    request.mockResolvedValueOnce(view("PUHU-BBBB2345"));
    await fetchInviteCode();
    expect(peekInviteCode()).toBe("PUHU-BBBB2345");
  });

  it("keeps the remembered code when a later fetch fails", async () => {
    request.mockResolvedValueOnce(view("PUHU-AAAA2345")).mockRejectedValueOnce(new Error("network"));
    await fetchInviteCode();
    await expect(fetchInviteCode()).rejects.toThrow("network");
    expect(peekInviteCode()).toBe("PUHU-AAAA2345");
  });

  it("does not remember a code that was never returned", async () => {
    request.mockRejectedValueOnce(new Error("network"));
    await expect(fetchInviteCode()).rejects.toThrow("network");
    expect(peekInviteCode()).toBeNull();
  });
});

describe("forgetInviteCode", () => {
  it("clears the code, so another account never inherits it", async () => {
    request.mockResolvedValueOnce(view("PUHU-AAAA2345"));
    await fetchInviteCode();

    forgetInviteCode();

    expect(peekInviteCode()).toBeNull();
  });

  it("drops a response that lands after the account changed", async () => {
    let land: (value: ReturnType<typeof view>) => void = () => {};
    request.mockReturnValueOnce(new Promise((resolve) => (land = resolve)));
    const pending = fetchInviteCode();

    forgetInviteCode();
    land(view("PUHU-OLDUSER2"));
    await pending;

    expect(peekInviteCode()).toBeNull();
  });
});

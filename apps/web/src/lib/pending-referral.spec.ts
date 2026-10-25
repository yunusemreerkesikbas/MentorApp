import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumePendingReferral, rememberPendingReferral } from "./pending-referral";

const KEY = "mentor.pendingReferral";

/** Node has no `window`; a Map-backed stand-in is enough for the three calls the module makes. */
function stubSessionStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  return store;
}

describe("pending referral", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = stubSessionStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hands the code back once, then nothing", () => {
    rememberPendingReferral("PUHU-TEST2345");

    expect(consumePendingReferral()).toBe("PUHU-TEST2345");
    expect(consumePendingReferral()).toBeNull();
    expect(store.has(KEY)).toBe(false);
  });

  it("stores the canonical form of what the visitor typed or followed", () => {
    rememberPendingReferral("  puhu-test2345 ");
    expect(store.get(KEY)).toBe("PUHU-TEST2345");

    rememberPendingReferral("mentor-abcd2345");
    expect(consumePendingReferral()).toBe("PUHU-ABCD2345");
  });

  it("never stores something that is not an invite code", () => {
    rememberPendingReferral("<script>alert(1)</script>");
    rememberPendingReferral("");
    rememberPendingReferral("PUHU-");

    expect(store.has(KEY)).toBe(false);
    expect(consumePendingReferral()).toBeNull();
  });

  it("drops a tampered value on the way out and clears it", () => {
    store.set(KEY, "<script>");

    expect(consumePendingReferral()).toBeNull();
    expect(store.has(KEY)).toBe(false);
  });

  it("re-normalizes a hand-edited but valid value", () => {
    store.set(KEY, "puhu-test2345");

    expect(consumePendingReferral()).toBe("PUHU-TEST2345");
  });

  it("survives storage that throws", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });

    expect(() => rememberPendingReferral("PUHU-TEST2345")).not.toThrow();
    expect(consumePendingReferral()).toBeNull();
  });
});

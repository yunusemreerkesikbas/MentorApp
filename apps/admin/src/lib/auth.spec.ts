import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, removeLegacyStoredToken, setToken } from "./auth";

describe("admin memory-only access token", () => {
  beforeEach(() => clearToken());

  it("keeps the access token in module memory", () => {
    setToken("short-lived-access");
    expect(getToken()).toBe("short-lived-access");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("deletes the legacy localStorage credential without reading it", () => {
    const removeItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { removeItem } });

    removeLegacyStoredToken();

    expect(removeItem).toHaveBeenCalledWith("mentor_admin_token");
    vi.unstubAllGlobals();
  });
});

import { describe, expect, it } from "vitest";
import type { AxiosAdapter, AxiosResponse } from "axios";
import apiClient, { refreshAdminSession } from "./apiClient";
import { clearToken } from "./auth";

describe("admin session transport", () => {
  it("refreshes through the admin-only auth endpoint with credentials", async () => {
    clearToken();
    const originalAdapter = apiClient.defaults.adapter;
    const seen: Array<{ url: string | undefined; withCredentials: boolean | undefined }> = [];
    apiClient.defaults.adapter = (async (config) => {
      seen.push({ url: config.url, withCredentials: config.withCredentials });
      return {
        data: { accessToken: "admin-access", user: { roles: ["ADMIN"] } },
        status: 200, statusText: "OK", headers: {}, config,
      } satisfies AxiosResponse;
    }) satisfies AxiosAdapter;
    try {
      await refreshAdminSession();
      expect(seen).toEqual([{ url: "/auth/admin/refresh", withCredentials: true }]);
    } finally {
      apiClient.defaults.adapter = originalAdapter;
      clearToken();
    }
  });
});

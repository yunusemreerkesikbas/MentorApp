import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@mentor/api-client";
import { retryIdempotent } from "./ad-reward-retry";

describe("retryIdempotent", () => {
  it("retries an ambiguous failure once", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce("settled");

    await expect(retryIdempotent(operation)).resolves.toBe("settled");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not continue after the retry budget is exhausted", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(retryIdempotent(operation)).rejects.toThrow("offline");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry a definite client rejection", async () => {
    const operation = vi.fn().mockRejectedValue(
      new ApiClientError(422, { code: "VALIDATION_FAILED", message: "Invalid request" }),
    );

    await expect(retryIdempotent(operation)).rejects.toThrow("Invalid request");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("retries a server error because settlement may be ambiguous", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new ApiClientError(503, { code: "INTERNAL_ERROR", message: "Unavailable" }))
      .mockResolvedValueOnce("settled");

    await expect(retryIdempotent(operation)).resolves.toBe("settled");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

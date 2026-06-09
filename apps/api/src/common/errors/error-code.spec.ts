import { describe, expect, it } from "vitest";
import { httpStatusToErrorCode } from "./error-code";

describe("httpStatusToErrorCode", () => {
  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [413, "PAYLOAD_TOO_LARGE"],
    [429, "TOO_MANY_REQUESTS"],
    [503, "SERVICE_UNAVAILABLE"],
    [500, "INTERNAL_ERROR"],
    [418, "BAD_REQUEST"],
  ])("maps status %i → %s", (status, code) => {
    expect(httpStatusToErrorCode(status as number)).toBe(code);
  });
});

import { describe, expect, it } from "vitest";
import { ApiClientError } from "@mentor/api-client";
import { studyRoomJoinFailure } from "./study-rooms";

const apiError = (code: string) =>
  new ApiClientError(404, { code, message: "x" } as ConstructorParameters<typeof ApiClientError>[1]);

describe("studyRoomJoinFailure", () => {
  it("names a join into a table you already sit at", () => {
    expect(studyRoomJoinFailure(apiError("COACHING_ROOM_ALREADY_MEMBER"))).toBe("already_member");
  });

  it("reads an unknown code and a closed room the same way", () => {
    expect(studyRoomJoinFailure(apiError("COACHING_ROOM_CODE_INVALID"))).toBe("invalid");
    expect(studyRoomJoinFailure(apiError("COACHING_ROOM_NOT_FOUND"))).toBe("invalid");
  });

  it("names a bad shape, a full table, and the membership cap", () => {
    expect(studyRoomJoinFailure(apiError("VALIDATION_ERROR"))).toBe("malformed");
    expect(studyRoomJoinFailure(apiError("COACHING_ROOM_FULL"))).toBe("full");
    expect(studyRoomJoinFailure(apiError("COACHING_ROOM_QUOTA_EXCEEDED"))).toBe("quota");
  });

  it("falls back to a retryable error when the connection drops", () => {
    expect(studyRoomJoinFailure(new TypeError("Failed to fetch"))).toBe("error");
  });
});

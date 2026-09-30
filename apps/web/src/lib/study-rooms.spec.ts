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

  it("falls back to a retryable error for anything else", () => {
    expect(studyRoomJoinFailure(apiError("COACHING_ROOM_FULL"))).toBe("error");
    expect(studyRoomJoinFailure(new TypeError("Failed to fetch"))).toBe("error");
  });
});

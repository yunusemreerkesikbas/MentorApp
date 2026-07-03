import { describe, expect, it } from "vitest";
import { isValidAvatarStorageKey } from "./avatar";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("avatar storage key", () => {
  it("accepts only the current user's avatar key", () => {
    expect(
      isValidAvatarStorageKey(
        USER_ID,
        `avatars/${USER_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`,
      ),
    ).toBe(true);
    expect(
      isValidAvatarStorageKey(
        USER_ID,
        "avatars/22222222-2222-4222-8222-222222222222/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg",
      ),
    ).toBe(false);
  });

  it("rejects non-avatar paths and unsupported extensions", () => {
    expect(
      isValidAvatarStorageKey(
        USER_ID,
        `mock-exams/${USER_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`,
      ),
    ).toBe(false);
    expect(
      isValidAvatarStorageKey(
        USER_ID,
        `avatars/${USER_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.gif`,
      ),
    ).toBe(false);
  });
});

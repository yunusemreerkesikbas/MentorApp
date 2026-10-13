import { describe, expect, it, vi } from "vitest";
import { assertSignupAdmission } from "./signup-admission";

function settings(open = true, pilot = false, emails: string[] = [], capacity = 50) {
  const values: Record<string, boolean | number> = {
    "signup.enabled": open,
    "signup.pilot.enabled": pilot,
    "signup.pilot.max_invited_emails": capacity,
  };
  const registry = {
    get: vi.fn(async (key: string) => values[key]),
  };
  const env = { getOrThrow: vi.fn(() => emails) };
  return { registry, env, assert: (email: string) => assertSignupAdmission(registry as never, env as never, email) };
}

describe("signup admission", () => {
  it.each([false, true])("closed registration rejects new accounts when pilot=%s", async (pilot) => {
    const config = settings(false, pilot, ["invited@example.com"]);
    await expect(config.assert("invited@example.com")).rejects.toMatchObject({ code: "AUTH_SIGNUP_CLOSED", httpStatus: 403 });
    expect(config.env.getOrThrow).not.toHaveBeenCalled();
  });

  it("public registration does not require an invitation list", async () => {
    const config = settings();
    await expect(config.assert("student@example.com")).resolves.toBeUndefined();
    expect(config.env.getOrThrow).not.toHaveBeenCalled();
  });

  it.each([[], ["someone-else@example.com"]])("pilot refuses addresses outside the exact list: %j", async (emails) => {
    await expect(settings(true, true, emails).assert("student@example.com"))
      .rejects.toMatchObject({ code: "AUTH_PILOT_INVITATION_REQUIRED", httpStatus: 403 });
  });

  it("allows the invited normalized address", async () => {
    await expect(settings(true, true, ["student@example.com"]).assert("student@example.com")).resolves.toBeUndefined();
  });

  it.each(["student+other@example.com", "stu.dent@example.com", "student@other.example.com"])("does not broaden invitations to %s", async (email) => {
    await expect(settings(true, true, ["student@example.com"]).assert(email))
      .rejects.toMatchObject({ code: "AUTH_PILOT_INVITATION_REQUIRED" });
  });

  it("fails closed when the list exceeds the configured cohort size", async () => {
    await expect(settings(true, true, ["student@example.com", "other@example.com"], 1).assert("student@example.com"))
      .rejects.toMatchObject({ code: "AUTH_SIGNUP_CLOSED" });
  });

  it("does not expose invitation addresses in a rejection", async () => {
    const error = await settings(true, true, ["private@example.com"]).assert("student@example.com").catch((reason: unknown) => reason);
    expect(String(error)).not.toContain("private@example.com");
    expect(JSON.stringify(error)).not.toContain("private@example.com");
  });
});

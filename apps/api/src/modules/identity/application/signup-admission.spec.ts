import { describe, expect, it, vi } from "vitest";
import { assertSignupAdmission } from "./signup-admission";

function settings(open = true, pilot = false, invited: { role: "student" | "coach" } | null = null, capacity = 50) {
  const values: Record<string, boolean | number> = {
    "signup.enabled": open,
    "signup.pilot.enabled": pilot,
    "signup.pilot.max_invited_emails": capacity,
  };
  const registry = { get: vi.fn(async (key: string) => values[key]) };
  const invitations = { findInvited: vi.fn(async () => invited) };
  return {
    registry,
    invitations,
    assert: (email: string) => assertSignupAdmission(registry as never, invitations as never, email),
  };
}

describe("signup admission", () => {
  it("closed rejects even an invited address", async () => {
    const config = settings(false, true, { role: "student" });
    await expect(config.assert("invited@example.com")).rejects.toMatchObject({ code: "AUTH_SIGNUP_CLOSED", httpStatus: 403 });
    expect(config.invitations.findInvited).not.toHaveBeenCalled();
  });

  it("open mode needs no invitation", async () => {
    const config = settings();
    await expect(config.assert("student@example.com")).resolves.toEqual({ mode: "open" });
    expect(config.invitations.findInvited).not.toHaveBeenCalled();
  });

  it("invite mode without a row is refused", async () => {
    await expect(settings(true, true, null).assert("student@example.com"))
      .rejects.toMatchObject({ code: "AUTH_PILOT_INVITATION_REQUIRED", httpStatus: 403 });
  });

  it("invite mode returns the row role", async () => {
    const config = settings(true, true, { role: "coach" });
    await expect(config.assert("coach@example.com")).resolves.toEqual({ mode: "invited", role: "coach" });
    expect(config.invitations.findInvited).toHaveBeenCalledWith("coach@example.com");
  });

  it("a lowered capacity never closes admission", async () => {
    const config = settings(true, true, { role: "student" }, 1);
    await expect(config.assert("student@example.com")).resolves.toEqual({ mode: "invited", role: "student" });
    expect(config.registry.get).not.toHaveBeenCalledWith("signup.pilot.max_invited_emails");
  });

  it("rejection does not expose addresses", async () => {
    const error = await settings(true, true, null).assert("private@example.com").catch((reason: unknown) => reason);
    expect(String(error)).not.toContain("private@example.com");
    expect(JSON.stringify(error)).not.toContain("private@example.com");
  });
});

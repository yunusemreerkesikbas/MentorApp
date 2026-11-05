import { describe, expect, it, vi } from "vitest";
import { WaitlistService } from "./waitlist.service";

function setup(opts: { enabled?: boolean; pilot?: boolean; user?: boolean; invited?: number; max?: number; alreadyInvited?: boolean; row?: Record<string, unknown> | null } = {}) {
  const values: Record<string, unknown> = {
    "signup.pilot.max_invited_emails": opts.max ?? 50,
    "signup.enabled": opts.enabled ?? true,
    "signup.pilot.enabled": opts.pilot ?? true,
  };
  const row = (over: Record<string, unknown> = {}) => ({
    id: "r1", email: "a@b.com", role: "student", status: "waiting", locale: "tr",
    createdAt: new Date("2026-11-01T10:00:00Z"), invitedAt: null, invitedBy: null, ...over,
  });
  const invitations = {
    insertWaiting: vi.fn(async () => undefined),
    purgeExpired: vi.fn(async () => undefined),
    countInvited: vi.fn(async () => opts.invited ?? 0),
    findById: vi.fn(async () => opts.row === undefined ? row() : opts.row),
    findInvited: vi.fn(async () => opts.alreadyInvited ? { role: "student" } : null),
    markInvited: vi.fn(async (_id: string, by: string) =>
      row({ status: "invited", invitedAt: new Date("2026-11-05T10:00:00Z"), invitedBy: by, ...(opts.row ?? {}) })),
    upsertInvited: vi.fn(async (i: { email: string; role: string; locale: string; invitedBy: string }) =>
      row({ ...i, status: "invited", invitedAt: new Date("2026-11-05T10:00:00Z") })),
    deleteById: vi.fn(async () => opts.row !== null),
    list: vi.fn(async () => ({ items: [row()], total: 1, page: 1, pageSize: 20 })),
  };
  const queue = { enqueue: vi.fn(async () => undefined) };
  const config = { get: vi.fn(() => "https://app.test") };
  const users = { findByEmailService: vi.fn(async () => (opts.user ? { id: "u1" } : undefined)) };
  const turnstile = { assertValid: vi.fn(async () => undefined) };
  const registry = { get: vi.fn(async (key: string) => values[key]) };
  const service = new WaitlistService(invitations as never, users as never, turnstile as never, registry as never, queue as never, config as never);
  return { service, invitations, users, turnstile, queue };
}

describe("WaitlistService", () => {
  it("stores a normalized waiting row", async () => {
    const f = setup();
    await f.service.join({ email: "  Ayse@Ornek.COM ", role: "student", locale: "tr" });
    expect(f.users.findByEmailService).toHaveBeenCalledWith("ayse@ornek.com");
    expect(f.invitations.insertWaiting).toHaveBeenCalledWith({ email: "ayse@ornek.com", role: "student", locale: "tr" });
  });

  it("existing user adds no row", async () => {
    const f = setup({ user: true });
    await expect(f.service.join({ email: "a@b.com", role: "student", locale: "tr" })).resolves.toBeUndefined();
    expect(f.invitations.insertWaiting).not.toHaveBeenCalled();
  });

  it("open mode adds no row", async () => {
    const f = setup({ enabled: true, pilot: false });
    await f.service.join({ email: "a@b.com", role: "coach", locale: "en" });
    expect(f.invitations.insertWaiting).not.toHaveBeenCalled();
  });

  it("closed mode still collects the waitlist", async () => {
    const f = setup({ enabled: false, pilot: false });
    await f.service.join({ email: "a@b.com", role: "coach", locale: "en" });
    expect(f.invitations.insertWaiting).toHaveBeenCalledWith({ email: "a@b.com", role: "coach", locale: "en" });
  });

  it("asserts turnstile with action waitlist", async () => {
    const f = setup();
    await f.service.join({ email: "a@b.com", role: "student", locale: "tr", turnstileToken: "tok" });
    expect(f.turnstile.assertValid).toHaveBeenCalledWith("tok", "waitlist");
  });

  it("stores nothing when turnstile fails", async () => {
    const f = setup();
    f.turnstile.assertValid.mockRejectedValueOnce(new Error("bad"));
    await expect(f.service.join({ email: "a@b.com", role: "student", locale: "tr" })).rejects.toThrow("bad");
    expect(f.invitations.insertWaiting).not.toHaveBeenCalled();
  });

  describe("admin", () => {
    const mail = (to: string, link: string, lang: "tr" | "en" = "tr") => ({
      to, template: "identity.signup-invitation", variables: { link, lang },
    });

    it("invite at the cap is refused", async () => {
      const f = setup({ invited: 5, max: 5 });
      await expect(f.service.invite("r1", "admin1")).rejects.toMatchObject({ code: "WAITLIST_INVITE_LIMIT", httpStatus: 409 });
      expect(f.invitations.markInvited).not.toHaveBeenCalled();
      expect(f.queue.enqueue).not.toHaveBeenCalled();
    });

    it("lowered capacity still lets an already-invited row be re-invited and resent", async () => {
      const f = setup({ invited: 9, max: 5, row: { status: "invited", invitedAt: new Date() } });
      await expect(f.service.invite("r1", "admin1")).resolves.toMatchObject({ status: "invited" });
      await expect(f.service.resend("r1")).resolves.toBeUndefined();
      expect(f.queue.enqueue).toHaveBeenCalledTimes(2);
    });

    it("invite enqueues the invitation email", async () => {
      const f = setup();
      const entry = await f.service.invite("r1", "admin1");
      expect(entry).toMatchObject({ id: "r1", status: "invited", createdAt: "2026-11-01T10:00:00.000Z" });
      expect(f.invitations.markInvited).toHaveBeenCalledWith("r1", "admin1");
      expect(f.queue.enqueue).toHaveBeenCalledWith("notifications.send-email", mail("a@b.com", "https://app.test/kayit?davet=1"));
    });

    it("coach link carries rol=koc", async () => {
      const f = setup({ row: { role: "coach" } });
      await f.service.invite("r1", "admin1");
      expect(f.queue.enqueue).toHaveBeenCalledWith("notifications.send-email", mail("a@b.com", "https://app.test/kayit?davet=1&rol=koc"));
    });

    it("en row links to /en/signup?davet=1 and enqueues the EN email", async () => {
      const f = setup({ row: { locale: "en" } });
      await f.service.invite("r1", "admin1");
      expect(f.queue.enqueue).toHaveBeenCalledWith("notifications.send-email", mail("a@b.com", "https://app.test/en/signup?davet=1", "en"));
    });

    it("resend of an en row stays EN", async () => {
      const f = setup({ row: { id: "r1", email: "a@b.com", role: "student", status: "invited", locale: "en", invitedAt: new Date() } });
      await f.service.resend("r1");
      expect(f.queue.enqueue).toHaveBeenCalledWith("notifications.send-email", mail("a@b.com", "https://app.test/en/signup?davet=1", "en"));
    });

    it("invite of a missing row is not found", async () => {
      const f = setup({ row: null });
      await expect(f.service.invite("r1", "admin1")).rejects.toMatchObject({ code: "WAITLIST_ENTRY_NOT_FOUND", httpStatus: 404 });
    });

    it("inviteEmail trims and lower-cases before the repository", async () => {
      const f = setup();
      await f.service.inviteEmail({ email: "  New@Ornek.COM ", role: "coach", locale: "en" }, "admin1");
      expect(f.invitations.upsertInvited).toHaveBeenCalledWith({ email: "new@ornek.com", role: "coach", locale: "en", invitedBy: "admin1" });
      expect(f.queue.enqueue).toHaveBeenCalledWith("notifications.send-email", mail("new@ornek.com", "https://app.test/en/signup?davet=1&rol=koc", "en"));
    });

    it("inviteEmail at the cap is refused for a new address but allowed for an invited one", async () => {
      const full = setup({ invited: 5, max: 5 });
      await expect(full.service.inviteEmail({ email: "x@y.com", role: "student", locale: "tr" }, "a")).rejects.toMatchObject({ code: "WAITLIST_INVITE_LIMIT" });
      expect(full.invitations.upsertInvited).not.toHaveBeenCalled();
      const known = setup({ invited: 5, max: 5, alreadyInvited: true });
      await expect(known.service.inviteEmail({ email: "x@y.com", role: "student", locale: "tr" }, "a")).resolves.toBeDefined();
    });

    it("inviteEmail refuses an address that already has an account, before any row or email", async () => {
      const f = setup({ user: true });
      await expect(f.service.inviteEmail({ email: " Taken@Ornek.com", role: "student", locale: "tr" }, "a"))
        .rejects.toMatchObject({ code: "AUTH_EMAIL_IN_USE", httpStatus: 409 });
      expect(f.users.findByEmailService).toHaveBeenCalledWith("taken@ornek.com");
      expect(f.invitations.upsertInvited).not.toHaveBeenCalled();
      expect(f.queue.enqueue).not.toHaveBeenCalled();
    });

    it("resend of a waiting row is not found", async () => {
      const f = setup();
      await expect(f.service.resend("r1")).rejects.toMatchObject({ code: "WAITLIST_ENTRY_NOT_FOUND", httpStatus: 404 });
      expect(f.queue.enqueue).not.toHaveBeenCalled();
    });

    it("remove of a missing row is not found", async () => {
      const f = setup({ row: null });
      await expect(f.service.remove("r1")).rejects.toMatchObject({ code: "WAITLIST_ENTRY_NOT_FOUND" });
    });

    it("list maps rows to admin entries", async () => {
      const f = setup();
      const page = await f.service.list({ page: 1, pageSize: 20 });
      expect(page.items[0]).toEqual({ id: "r1", email: "a@b.com", role: "student", status: "waiting", locale: "tr", createdAt: "2026-11-01T10:00:00.000Z", invitedAt: null });
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { AccountErasureService } from "./account-erasure.service";

const USER = "11111111-1111-4111-8111-111111111111";

describe("AccountErasureService", () => {
  let anonymizeAccount: ReturnType<typeof vi.fn>;
  let beginAccountErasure: ReturnType<typeof vi.fn>;
  let releaseAccountErasure: ReturnType<typeof vi.fn>;
  const startedAt = new Date("2026-10-03T10:00:00.000Z");
  let revokeAllForUser: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;
  let eraseAi: ReturnType<typeof vi.fn>;
  let eraseAds: ReturnType<typeof vi.fn>;
  let eraseCoaching: ReturnType<typeof vi.fn>;
  let eraseForum: ReturnType<typeof vi.fn>;
  let eraseSocial: ReturnType<typeof vi.fn>;
  let eraseMentorship: ReturnType<typeof vi.fn>;
  let eraseNotifications: ReturnType<typeof vi.fn>;
  let deleteObject: ReturnType<typeof vi.fn>;
  let detachPhoneTrials: ReturnType<typeof vi.fn>;
  let service: AccountErasureService;

  beforeEach(() => {
    beginAccountErasure = vi.fn(async () => startedAt);
    releaseAccountErasure = vi.fn(async () => undefined);
    anonymizeAccount = vi.fn(async () => ({
      before: { email: "a@x.io" },
      after: { email: "deleted+u@anonymized.local" },
      avatarStorageKey: "avatars/u.png",
    }));
    revokeAllForUser = vi.fn(async () => undefined);
    cancel = vi.fn(async () => undefined);
    eraseAi = vi.fn(async () => undefined);
    eraseAds = vi.fn(async () => undefined);
    eraseCoaching = vi.fn(async () => undefined);
    eraseForum = vi.fn(async () => undefined);
    eraseSocial = vi.fn(async () => undefined);
    eraseMentorship = vi.fn(async () => undefined);
    eraseNotifications = vi.fn(async () => undefined);
    deleteObject = vi.fn(async () => undefined);
    detachPhoneTrials = vi.fn(async () => undefined);
    service = new AccountErasureService(
      { anonymizeAccount, beginAccountErasure, releaseAccountErasure } as never,
      { revokeAllForUser } as never,
      { cancel } as never,
      { eraseUserData: eraseAi } as never,
      { eraseUserData: eraseAds } as never,
      { eraseUserData: eraseCoaching } as never,
      { eraseUserData: eraseForum } as never,
      { eraseUserData: eraseSocial } as never,
      { eraseUserData: eraseMentorship } as never,
      { eraseUserData: eraseNotifications } as never,
      { deleteObject } as never,
      { detachUser: detachPhoneTrials } as never,
    );
  });

  it("cancels the subscription, erases every module, anonymizes the row and kills sessions", async () => {
    const res = await service.eraseAccount(USER, "DELETED");

    expect(cancel).toHaveBeenCalledWith(USER);
    expect(eraseAi).toHaveBeenCalledWith(USER);
    expect(eraseAds).toHaveBeenCalledWith(USER);
    expect(eraseCoaching).toHaveBeenCalledWith(USER);
    expect(eraseForum).toHaveBeenCalledWith(USER);
    expect(eraseSocial).toHaveBeenCalledWith(USER);
    expect(eraseMentorship).toHaveBeenCalledWith(USER);
    expect(eraseNotifications).toHaveBeenCalledWith(USER);
    expect(detachPhoneTrials).toHaveBeenCalledWith(USER);
    expect(anonymizeAccount).toHaveBeenCalledWith(USER, "DELETED");
    expect(revokeAllForUser).toHaveBeenCalledWith(USER);
    expect(deleteObject).toHaveBeenCalledWith("avatars/u.png");
    expect(res.after).toMatchObject({ email: "deleted+u@anonymized.local" });
  });

  it("cancels the subscription BEFORE erasing — an erased account must not keep billing", async () => {
    const order: string[] = [];
    beginAccountErasure.mockImplementation(async () => { order.push("fence"); return startedAt; });
    cancel.mockImplementation(async () => void order.push("cancel"));
    eraseAi.mockImplementation(async () => void order.push("ai"));
    anonymizeAccount.mockImplementation(async () => {
      order.push("identity");
      return { before: {}, after: {}, avatarStorageKey: null };
    });

    await service.eraseAccount(USER, "DELETED");

    expect(order).toEqual(["fence", "cancel", "ai", "identity"]);
  });

  it("continues when the user has no open subscription", async () => {
    cancel.mockRejectedValue(new NotFoundError());

    await expect(service.eraseAccount(USER, "DELETED")).resolves.toBeDefined();
    expect(eraseAi).toHaveBeenCalledWith(USER);
  });

  it("propagates a real cancel failure instead of erasing a still-billing account", async () => {
    cancel.mockRejectedValue(new Error("iyzico down"));

    await expect(service.eraseAccount(USER, "DELETED")).rejects.toThrow("iyzico down");
    expect(eraseAi).not.toHaveBeenCalled();
    expect(anonymizeAccount).not.toHaveBeenCalled();
    expect(releaseAccountErasure).toHaveBeenCalledWith(USER, startedAt);
  });

  it("propagates an erasure failure instead of reporting a half-done deletion", async () => {
    eraseCoaching.mockRejectedValue(new Error("coaching down"));

    await expect(service.eraseAccount(USER, "DELETED")).rejects.toThrow("coaching down");
    expect(anonymizeAccount).not.toHaveBeenCalled();
    expect(releaseAccountErasure).toHaveBeenCalledWith(USER, startedAt);
  });

  it("still completes when only the avatar object cannot be deleted (best-effort storage)", async () => {
    deleteObject.mockRejectedValue(new Error("storage down"));

    await expect(service.eraseAccount(USER, "DELETED")).resolves.toBeDefined();
    expect(revokeAllForUser).toHaveBeenCalledWith(USER);
  });

  it("passes the admin status through (BANNED) for the admin anonymize path", async () => {
    await service.eraseAccount(USER, "BANNED");

    expect(anonymizeAccount).toHaveBeenCalledWith(USER, "BANNED");
  });

  it("does not cancel or erase if another erasure already holds the fence", async () => {
    beginAccountErasure.mockRejectedValue(new DomainError("CONFLICT", 409));
    await expect(service.eraseAccount(USER, "DELETED")).rejects.toMatchObject({ code: "CONFLICT", httpStatus: 409 });
    expect(cancel).not.toHaveBeenCalled();
    expect(eraseAi).not.toHaveBeenCalled();
    expect(releaseAccountErasure).not.toHaveBeenCalled();
  });

  it("releases its fence without erasing behavior when checkout acceptance is unknown", async () => {
    cancel.mockRejectedValue(new DomainError("PAYMENT_TRIAL_PENDING", 409));
    await expect(service.eraseAccount(USER, "DELETED")).rejects.toMatchObject({ code: "PAYMENT_TRIAL_PENDING" });
    expect(eraseAi).not.toHaveBeenCalled();
    expect(detachPhoneTrials).not.toHaveBeenCalled();
    expect(anonymizeAccount).not.toHaveBeenCalled();
    expect(releaseAccountErasure).toHaveBeenCalledWith(USER, startedAt);
  });

  it("never releases a completed terminal scrub if session cleanup fails", async () => {
    revokeAllForUser.mockRejectedValue(new Error("session cleanup down"));
    await expect(service.eraseAccount(USER, "DELETED")).rejects.toThrow("session cleanup down");
    expect(anonymizeAccount).toHaveBeenCalled();
    expect(releaseAccountErasure).not.toHaveBeenCalled();
  });
});

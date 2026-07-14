import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../common/errors/domain-error";
import { AccountErasureService } from "./account-erasure.service";

const USER = "11111111-1111-4111-8111-111111111111";

describe("AccountErasureService", () => {
  let anonymizeAccount: ReturnType<typeof vi.fn>;
  let revokeAllForUser: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;
  let eraseAi: ReturnType<typeof vi.fn>;
  let eraseCoaching: ReturnType<typeof vi.fn>;
  let deleteObject: ReturnType<typeof vi.fn>;
  let service: AccountErasureService;

  beforeEach(() => {
    anonymizeAccount = vi.fn(async () => ({
      before: { email: "a@x.io" },
      after: { email: "deleted+u@anonymized.local" },
      avatarStorageKey: "avatars/u.png",
    }));
    revokeAllForUser = vi.fn(async () => undefined);
    cancel = vi.fn(async () => undefined);
    eraseAi = vi.fn(async () => undefined);
    eraseCoaching = vi.fn(async () => undefined);
    deleteObject = vi.fn(async () => undefined);
    service = new AccountErasureService(
      { anonymizeAccount } as never,
      { revokeAllForUser } as never,
      { cancel } as never,
      { eraseUserData: eraseAi } as never,
      { eraseUserData: eraseCoaching } as never,
      { deleteObject } as never,
    );
  });

  it("cancels the subscription, erases every module, anonymizes the row and kills sessions", async () => {
    const res = await service.eraseAccount(USER, "DELETED");

    expect(cancel).toHaveBeenCalledWith(USER);
    expect(eraseAi).toHaveBeenCalledWith(USER);
    expect(eraseCoaching).toHaveBeenCalledWith(USER);
    expect(anonymizeAccount).toHaveBeenCalledWith(USER, "DELETED");
    expect(revokeAllForUser).toHaveBeenCalledWith(USER);
    expect(deleteObject).toHaveBeenCalledWith("avatars/u.png");
    expect(res.after).toMatchObject({ email: "deleted+u@anonymized.local" });
  });

  it("cancels the subscription BEFORE erasing — an erased account must not keep billing", async () => {
    const order: string[] = [];
    cancel.mockImplementation(async () => void order.push("cancel"));
    eraseAi.mockImplementation(async () => void order.push("ai"));
    anonymizeAccount.mockImplementation(async () => {
      order.push("identity");
      return { before: {}, after: {}, avatarStorageKey: null };
    });

    await service.eraseAccount(USER, "DELETED");

    expect(order).toEqual(["cancel", "ai", "identity"]);
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
  });

  it("propagates an erasure failure instead of reporting a half-done deletion", async () => {
    eraseCoaching.mockRejectedValue(new Error("coaching down"));

    await expect(service.eraseAccount(USER, "DELETED")).rejects.toThrow("coaching down");
    expect(anonymizeAccount).not.toHaveBeenCalled();
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
});

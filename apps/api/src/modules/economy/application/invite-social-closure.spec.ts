import { describe, expect, it, vi } from "vitest";
import { SocialAccessPolicy } from "../../../common/config/social-access.policy";
import { InviteService } from "./invite.service";
import { InviteViewService } from "./invite-view.service";

describe("social closure before invite side effects", () => {
  it("rejects code creation, lookup, redemption and preview before any invite/identity access", async () => {
    const policy = new SocialAccessPolicy({ get: async () => false } as never);
    const repo = {
      findByInviter: vi.fn().mockResolvedValue({ code: "CODE1234" }),
      findByCode: vi.fn().mockResolvedValue(undefined),
      createRedemption: vi.fn(),
    };
    const users = { findByIdService: vi.fn().mockResolvedValue(undefined) };
    const service = new InviteService(repo as never, {} as never, {} as never,
      { get: async () => true } as never, {} as never, users as never,
      {} as never, {} as never, {} as never, {} as never, policy);
    const views = new InviteViewService(service, repo as never, { get: async () => true } as never,
      {} as never, users as never, {} as never, {} as never, policy);
    for (const call of [
      () => service.getOrCreateCode("viewer"), () => service.resolveValidInvite("CODE1234"),
      () => service.redeem("viewer", "CODE1234"), () => views.getView("viewer"),
      () => views.getPreview("CODE1234"),
    ]) await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
    for (const spy of [...Object.values(repo), ...Object.values(users)]) expect(spy).not.toHaveBeenCalled();
  });
});

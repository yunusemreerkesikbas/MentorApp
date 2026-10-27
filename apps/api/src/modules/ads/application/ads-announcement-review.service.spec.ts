import { describe, expect, it, vi } from "vitest";
import { AdsAnnouncementReviewService } from "./ads-announcement-review.service";
import { AdsService } from "./ads.service";
import { AdPlacementId } from "@mentor/types";
import { CONFIG_CATALOG } from "../../../common/config/config.catalog";

const revision = "a".repeat(64), actor = { id: "editor", roles: ["EDITOR"] };
function setup() {
  const pages = { getReviewSnapshot: vi.fn(async (): Promise<unknown> => ({ contentRevision: revision, examType: "LGS" })) };
  const repo = { find: vi.fn(async (): Promise<unknown> => ({ contentRevision: revision, reviewedBy: "editor", reviewedAt: new Date() })), approve: vi.fn(), revoke: vi.fn() };
  const service = new AdsAnnouncementReviewService(repo as never, pages as never);
  return { service, pages, repo };
}
describe("announcement review scope", () => {
  it("requires matching rendered/current/approved revisions", async () => {
    const s = setup();
    expect(await s.service.resolve(actor, { threadId: "t", contentRevision: revision })).toEqual({ verified: true, examType: "LGS" });
    expect(s.repo.find).toHaveBeenCalledWith("t", "ANNOUNCEMENT");
    expect((await s.service.resolve(actor, { threadId: "t", contentRevision: "b".repeat(64) })).verified).toBe(false);
    s.repo.find.mockResolvedValue(undefined);
    expect((await s.service.resolve(actor, { threadId: "t", contentRevision: revision })).verified).toBe(false);
  });
  it("rejects stale and unavailable previews before storing scoped approval", async () => {
    const s = setup();
    await expect(s.service.approve("t", actor, "b".repeat(64))).rejects.toMatchObject({ httpStatus: 409 });
    expect(s.repo.approve).not.toHaveBeenCalled();
    await s.service.approve("t", actor, revision);
    expect(s.repo.approve).toHaveBeenCalledWith("t", revision, actor.id, "ANNOUNCEMENT");
    s.pages.getReviewSnapshot.mockResolvedValue(null);
    await expect(s.service.approve("t", actor, revision)).rejects.toMatchObject({ httpStatus: 404 });
  });
  it("revokes only announcements and fails closed after context failures", async () => {
    const s = setup(); await s.service.revoke("t");
    expect(s.repo.revoke).toHaveBeenCalledWith("t", "ANNOUNCEMENT");
    s.pages.getReviewSnapshot.mockRejectedValue(new Error("unavailable"));
    expect((await s.service.resolve(actor, { threadId: "t", contentRevision: revision })).verified).toBe(false);
    expect((await s.service.resolve(actor)).verified).toBe(false);
  });
  it("retains authentication, flags, units, country and ad-free policy", async () => {
    const review = setup(); const reviews = review.service;
    const config: Record<string, unknown> = { "ads.enabled": true, "ads.display.enabled": true, "ads.display.allowed_countries": "TR",
      "ads.placement.community_announcement_end.enabled": true, "ads.placement.community_announcement_end.ad_unit_path": "/123/announcement" };
    const env: Record<string, string> = { NODE_ENV: "production", APP_ENV: "production", APP_URL: "https://example.test", ADS_LOCAL_TEST_ENABLED: "true" };
    const ads = new AdsService({} as never, { get: async (key: string) => config[key] } as never,
      { get: (key: string) => env[key] } as never,
      { getEntitlement: async (_id: string, roles: string[]) => ({ isPremium: roles.includes("STAFF") || roles.includes("PREMIUM_TEST") }) } as never,
      { getDiscoveryProfile: async () => ({ examType: "KPSS" }) } as never, {} as never, {} as never, {} as never, {} as never, reviews);
    const get = (country: string | null = "TR", roles: string[] = []) => ads.getPlacement(AdPlacementId.COMMUNITY_ANNOUNCEMENT_END, "reader", roles, null, country, undefined, undefined, undefined, { threadId: "t", contentRevision: revision });
    await expect(ads.getPublicPlacement(AdPlacementId.COMMUNITY_ANNOUNCEMENT_END, null, null, "TR")).rejects.toMatchObject({ httpStatus: 404 });
    expect(await get()).toMatchObject({ enabled: true, audienceTreatment: "CHILD", sizes: [[250, 250], [300, 250]] });
    for (const country of [null, "US", "DE"]) expect(await get(country)).toMatchObject({ enabled: false });
    for (const roles of [["STAFF"], ["PREMIUM_TEST"]]) expect(await get("TR", roles)).toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
    config["ads.placement.community_announcement_end.ad_unit_path"] = "";
    expect(await get()).toMatchObject({ enabled: false, adUnitPath: null });
    config["ads.placement.community_announcement_end.ad_unit_path"] = "/123/restored";
    config["ads.placement.community_announcement_end.enabled"] = false;
    expect(await get()).toMatchObject({ enabled: false });
    expect(CONFIG_CATALOG["ads.placement.community_announcement_end.enabled"].default).toBe(false);
    expect(CONFIG_CATALOG["ads.placement.community_announcement_end.ad_unit_path"].schema.safeParse("<script>").success).toBe(false);
    env.NODE_ENV = "development"; env.APP_ENV = "development"; env.APP_URL = "http://localhost:3000";
    review.repo.find.mockResolvedValue(undefined);
    expect(await get()).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED", adUnitPath: null });
  });
});

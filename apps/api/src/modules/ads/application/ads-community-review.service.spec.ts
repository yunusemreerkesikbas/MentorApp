import { describe, expect, it, vi } from "vitest";
import { AdPlacementId, ExamType } from "@mentor/types";
import { CONFIG_CATALOG } from "../../../common/config/config.catalog";
import { AdsQuestionReviewService } from "./ads-question-review.service";
import { AdsService } from "./ads.service";

const revision = "b".repeat(64), publicRevision = "a".repeat(64);
const actor = { id: "reader", roles: ["STUDENT"] };
const context = { questionId: "question", contentRevision: revision };
function setup() {
  const snapshot = { contentRevision: revision, publicContentRevision: publicRevision, examType: "LGS" };
  const row = { contentRevision: publicRevision, communityContentRevision: revision,
    communityReviewedBy: "editor", communityReviewedAt: new Date() };
  const repo = { find: vi.fn(async () => row), approveCommunity: vi.fn(async () => true), revokeCommunity: vi.fn(), revoke: vi.fn() };
  const pages = { getReviewSnapshot: vi.fn(async () => snapshot) };
  const service = new AdsQuestionReviewService(repo as never, {} as never, pages as never);
  return { service, repo, pages, snapshot, row };
}
describe("independent community question approval", () => {
  it("requires both public and whole-view approval plus the rendered revision", async () => {
    const { service, row } = setup();
    expect(await service.resolveCommunity(actor, context)).toEqual({ verified: true, examType: "LGS" });
    expect(await service.resolveCommunity(actor, { ...context, contentRevision: "c".repeat(64) })).toMatchObject({ verified: false });
    row.communityContentRevision = "";
    expect(await service.resolveCommunity(actor, context)).toMatchObject({ verified: false });
  });
  it("fails closed for missing public approval, changed recommendations or unavailable snapshots", async () => {
    const { service, row, snapshot, pages } = setup();
    row.contentRevision = "old-public";
    expect(await service.resolveCommunity(actor, context)).toMatchObject({ verified: false });
    row.contentRevision = publicRevision; snapshot.contentRevision = "new-view";
    expect(await service.resolveCommunity(actor, context)).toMatchObject({ verified: false });
    pages.getReviewSnapshot.mockResolvedValueOnce(null as never);
    expect(await service.resolveCommunity(actor, context)).toMatchObject({ verified: false });
    expect(await service.resolveCommunity(actor)).toMatchObject({ verified: false });
  });
  it("rejects stale editor previews and concurrent public revocations", async () => {
    const { service, repo } = setup();
    await expect(service.approveCommunity("question", actor, "old-view")).rejects.toMatchObject({ httpStatus: 409 });
    expect(repo.approveCommunity).not.toHaveBeenCalled();
    repo.approveCommunity.mockResolvedValueOnce(false);
    await expect(service.approveCommunity("question", actor, revision)).rejects.toMatchObject({ httpStatus: 409 });
    await service.approveCommunity("question", actor, revision);
    expect(repo.approveCommunity).toHaveBeenCalledWith("question", publicRevision, revision, actor.id);
  });
  it("revokes only the community scope", async () => {
    const { service, repo } = setup();
    await service.revokeCommunity("question");
    expect(repo.revokeCommunity).toHaveBeenCalledWith("question");
    expect(repo.revoke).not.toHaveBeenCalled();
  });
  it("keeps anonymous access closed and all existing eligibility guards", async () => {
    const { service: reviews } = setup();
    const config: Record<string, unknown> = {
      "ads.enabled": true, "ads.display.enabled": true, "ads.display.allowed_countries": "TR",
      "ads.placement.community_question_end.enabled": true, "ads.placement.community_question_end.ad_unit_path": "/123/community",
    };
    const ads = new AdsService({} as never, { get: async (key: string) => config[key] } as never,
      { get: (key: string) => ({ NODE_ENV: "development", APP_URL: "http://localhost:3000", ADS_LOCAL_TEST_ENABLED: "false" })[key] } as never,
      { getEntitlement: async (_id: string, roles: string[]) => ({ isPremium: roles.includes("STAFF") || roles.includes("PREMIUM_TEST") }) } as never,
      { getDiscoveryProfile: async () => ({ examType: "KPSS" }) } as never, {} as never, {} as never, reviews, {} as never, {} as never);
    const get = (country = "TR", roles: string[] = []) => ads.getPlacement(AdPlacementId.COMMUNITY_QUESTION_END, actor.id, roles, null, country, undefined, context);
    await expect(ads.getPublicPlacement(AdPlacementId.COMMUNITY_QUESTION_END, null, ExamType.KPSS, "TR")).rejects.toMatchObject({ httpStatus: 404 });
    expect(await get()).toMatchObject({ enabled: true, audienceTreatment: "CHILD" });
    expect(await get("US")).toMatchObject({ enabled: false });
    for (const roles of [["STAFF"], ["PREMIUM_TEST"]]) expect(await get("TR", roles)).toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
    config["ads.placement.community_question_end.ad_unit_path"] = "";
    expect(await get()).toMatchObject({ enabled: false, reason: "PROVIDER_NOT_CONFIGURED" });
    config["ads.placement.community_question_end.enabled"] = false;
    expect(await get()).toMatchObject({ enabled: false, reason: "PLACEMENT_DISABLED" });
    expect(CONFIG_CATALOG["ads.placement.community_question_end.enabled"].default).toBe(false);
  });
});

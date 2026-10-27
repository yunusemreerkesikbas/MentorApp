import { describe, expect, it, vi } from "vitest";
import { AdsQuestionReviewService } from "./ads-question-review.service";
import { AdsService } from "./ads.service";
import { AdPlacementId } from "@mentor/types";
import { CONFIG_CATALOG } from "../../../common/config/config.catalog";

const revision = "a".repeat(64);
const questionId = "11111111-1111-4111-8111-111111111111";
function setup() {
  const question = { id: questionId, title: "Question", body: "Body", answers: [{ id: "answer", body: "Answer" }], contentRevision: revision, examType: "LGS" };
  const forum = { getQuestion: vi.fn(async () => question) };
  const repo = {
    find: vi.fn(async () => ({ questionId, contentRevision: revision, reviewedAt: new Date(), reviewedBy: "editor" })),
    approve: vi.fn(async () => undefined), revoke: vi.fn(async () => undefined),
  };
  const service = new AdsQuestionReviewService(repo as never, forum as never, {} as never);
  return { service, forum, repo, question };
}
describe("public question ad review", () => {
  it("requires both the rendered and current revision to match the approval", async () => {
    const { service } = setup();
    expect(await service.resolve({ questionId, contentRevision: revision })).toEqual({ verified: true, examType: "LGS" });
    expect(await service.resolve({ questionId, contentRevision: "b".repeat(64) })).toEqual({ verified: false, examType: null });
    expect(await service.resolve()).toEqual({ verified: false, examType: null });
  });
  it("rejects an absent or revoked approval", async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValueOnce(undefined as never);
    expect(await service.resolve({ questionId, contentRevision: revision })).toMatchObject({ verified: false });
  });
  it("rejects edited or hidden questions and unknown exam context", async () => {
    const { service, question, forum } = setup();
    question.contentRevision = "c".repeat(64);
    expect(await service.resolve({ questionId, contentRevision: revision })).toMatchObject({ verified: false });
    question.contentRevision = revision;
    question.examType = "UNKNOWN";
    expect(await service.resolve({ questionId, contentRevision: revision })).toMatchObject({ verified: false });
    forum.getQuestion.mockResolvedValueOnce(null as never);
    expect(await service.resolve({ questionId, contentRevision: revision })).toMatchObject({ verified: false });
  });
  it("cannot approve a revision different from the preview", async () => {
    const { service, repo } = setup();
    await expect(service.approve(questionId, "editor", "b".repeat(64))).rejects.toMatchObject({ httpStatus: 409 });
    expect(repo.approve).not.toHaveBeenCalled();
    await service.approve(questionId, "editor", revision);
    expect(repo.approve).toHaveBeenCalledWith(questionId, revision, "editor");
  });
  it("does not approve private, unanswered, disabled or unclassified inventory", async () => {
    const { service, forum, repo } = setup();
    forum.getQuestion.mockResolvedValueOnce(null as never);
    await expect(service.approve(questionId, "editor", revision)).rejects.toMatchObject({ httpStatus: 404 });
    expect(repo.approve).not.toHaveBeenCalled();
  });
  it("revokes approval even when a question is no longer public", async () => {
    const { service, forum, repo } = setup();
    forum.getQuestion.mockResolvedValue(null as never);
    await service.revoke(questionId);
    expect(repo.revoke).toHaveBeenCalledWith(questionId);
  });
  it.each([false, true])("keeps the review gate in normal and local sample modes (local=%s)", async (local) => {
    const { service: reviews, repo } = setup();
    const config: Record<string, unknown> = {
      "ads.enabled": true, "ads.display.enabled": true, "ads.display.allowed_countries": "TR",
      "ads.placement.forum_question_end.enabled": true, "ads.placement.forum_question_end.ad_unit_path": "/123/question",
    };
    const ads = new AdsService({} as never, { get: async (key: string) => config[key] } as never,
      { get: (key: string) => ({ NODE_ENV: "development", APP_URL: "http://localhost:3000", ADS_LOCAL_TEST_ENABLED: local ? "true" : "false" })[key] } as never,
      { getEntitlement: async (_user: string, roles: string[]) => ({ isPremium: roles.includes("STAFF") || roles.includes("PREMIUM_TEST") }) } as never,
      { getDiscoveryProfile: async () => ({ examType: "KPSS" }) } as never, {} as never, {} as never, reviews, {} as never, {} as never);
    const get = (country: string | null = "TR") => ads.getPublicPlacement(AdPlacementId.FORUM_QUESTION_END, null, null, country, undefined, { questionId, contentRevision: revision });
    repo.find.mockResolvedValueOnce(undefined as never);
    expect(await get()).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED", adUnitPath: null });
    expect(await get()).toMatchObject({ enabled: true, audienceTreatment: "CHILD" });
    expect(await get("US")).toMatchObject({ enabled: false });
    for (const roles of [["STAFF"], ["PREMIUM_TEST"]]) {
      expect(await ads.getPlacement(AdPlacementId.FORUM_QUESTION_END, "user", roles, null, "TR", undefined, { questionId, contentRevision: revision }))
        .toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
    }
    if (!local) {
      config["ads.placement.forum_question_end.ad_unit_path"] = "";
      expect(await get()).toMatchObject({ enabled: false, reason: "PROVIDER_NOT_CONFIGURED" });
      config["ads.placement.forum_question_end.enabled"] = false;
      expect(await get()).toMatchObject({ enabled: false, reason: "PLACEMENT_DISABLED" });
    }
    expect(CONFIG_CATALOG["ads.placement.forum_question_end.enabled"].default).toBe(false);
  });
});

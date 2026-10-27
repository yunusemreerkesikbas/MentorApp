import { describe, expect, it, vi } from "vitest";
import { AdPlacementId, ExamType } from "@mentor/types";
import { adPlacementQuerySchema } from "@mentor/validation";
import { CONFIG_CATALOG } from "../../../common/config/config.catalog";
import { AdsService } from "./ads.service";

const placement = AdPlacementId.COMMUNITY_OVERVIEW;
function setup(local = false) {
  const config: Record<string, unknown> = { "ads.enabled": true, "ads.display.enabled": true, "ads.display.allowed_countries": "TR",
    "ads.placement.community_overview.enabled": true, "ads.placement.community_overview.ad_unit_path": "/123/discovery" };
  const proof = { resolve: vi.fn(async () => ({ verified: true, examType: ExamType.LGS as ExamType | null })) };
  const profile = { examType: "KPSS" as string | null };
  const service = new AdsService({} as never, { get: async (key: string) => config[key] } as never,
    { get: (key: string) => ({ NODE_ENV: "development", APP_ENV: "development", APP_URL: "http://localhost:3000", ADS_LOCAL_TEST_ENABLED: String(local) })[key] } as never,
    { getEntitlement: async (_id: string, roles: string[]) => ({ isPremium: roles.includes("STAFF") || roles.includes("PREMIUM_TEST") }) } as never,
    { getDiscoveryProfile: async () => profile } as never, {} as never, {} as never, {} as never, proof as never, {} as never);
  const get = (country: string | null = "TR", roles: string[] = []) => service.getPlacement(placement, "reader", roles, null, country, undefined, undefined, "a".repeat(64));
  return { service, get, config, proof, profile };
}
describe("community overview placement", () => {
  it("requires authentication and accepts a revision without inventing a question ID", async () => {
    const s = setup();
    await expect(s.service.getPublicPlacement(placement, "article", null, "TR")).rejects.toMatchObject({ httpStatus: 404 });
    expect(adPlacementQuerySchema.parse({ contentRevision: "a".repeat(64) })).not.toHaveProperty("questionId");
    expect(await s.get()).toMatchObject({ enabled: true, audienceTreatment: "CHILD", sizes: [[250, 250], [300, 250]] });
    expect(s.proof.resolve).toHaveBeenCalledWith({ id: "reader", roles: [] }, "a".repeat(64));
  });
  it("retains independent defaults, validation and empty-unit protection", async () => {
    for (const suffix of ["enabled", "review_approved"]) expect(CONFIG_CATALOG[`ads.placement.community_overview.${suffix}` as keyof typeof CONFIG_CATALOG].default).toBe(false);
    const unit = CONFIG_CATALOG["ads.placement.community_overview.ad_unit_path"];
    expect(unit.schema.safeParse("<script>alert(1)</script>").success).toBe(false);
    const s = setup(); s.config["ads.placement.community_overview.ad_unit_path"] = "";
    expect(await s.get()).toMatchObject({ enabled: false, adUnitPath: null });
    s.config["ads.placement.community_overview.ad_unit_path"] = "/456/changed";
    expect(await s.get()).toMatchObject({ adUnitPath: "/456/changed" });
    s.config["ads.placement.community_overview.enabled"] = false;
    expect(await s.get()).toMatchObject({ enabled: false });
  });
  it.each([false, true])("does not bypass missing proof in local sample mode=%s", async (local) => {
    const s = setup(local); s.proof.resolve.mockResolvedValue({ verified: false, examType: null });
    expect(await s.get()).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED", adUnitPath: null });
  });
  it("preserves country, account and exam context restrictions", async () => {
    const s = setup();
    for (const country of [null, "US", "DE"]) expect(await s.get(country)).toMatchObject({ enabled: false });
    for (const roles of [["STAFF"], ["PREMIUM_TEST"]]) expect(await s.get("TR", roles)).toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
    s.profile.examType = null;
    expect(await s.get()).toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED" });
  });
});

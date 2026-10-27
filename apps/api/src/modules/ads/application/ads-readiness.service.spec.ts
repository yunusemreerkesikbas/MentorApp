import { describe, expect, it, vi } from "vitest";
import { AdPlacementId } from "@mentor/types";
import { CONFIG_CATALOG } from "../../../common/config/config.catalog";
import { AD_PLACEMENTS } from "../domain/ads.constants";
import { AdsReadinessService } from "./ads-readiness.service";

function setup() {
  const values: Record<string, unknown> = Object.fromEntries(Object.entries(CONFIG_CATALOG).filter(([key]) => key.startsWith("ads.")).map(([key, entry]) => [key, entry.default]));
  const config = { list: vi.fn(async () => Object.entries(values).map(([key, value]) => ({ key, value }))) };
  const env: Record<string, unknown> = { NODE_ENV: "production", APP_ENV: "production", APP_URL: "https://app.example.test/path?private=value", ADS_LOCAL_TEST_ENABLED: "false" };
  const service = new AdsReadinessService(config as never, { get: (key: string) => env[key] } as never);
  return { service, config, values, env };
}
describe("read-only display launch diagnostics", () => {
  it("covers all display placements from one registry read without raw units or inferred approvals", async () => {
    const s = setup(); const report = await s.service.getReport();
    expect(report.placements.map((row) => row.id).sort()).toEqual(Object.values(AD_PLACEMENTS).filter((row) => row.format === "DISPLAY").map((row) => row.id).sort());
    expect(report.placements).toHaveLength(8); expect(s.config.list).toHaveBeenCalledTimes(1);
    expect(report.externalVerification).toBe("NOT_CHECKED"); expect(report.siteOrigin).toBe("https://app.example.test");
    expect(report.placements.every((row) => !row.enabled && row.issues.includes("UNIT_MISSING"))).toBe(true);
    expect(JSON.stringify(report)).not.toContain("adUnitPath"); expect(JSON.stringify(report)).not.toContain("private=value");
  });
  it("preserves the blog-only legacy fallback and identifies configured test inventory", async () => {
    const s = setup(); s.env.GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT = "/123/legacy-private-unit";
    s.values["ads.placement.vision_overview.ad_unit_path"] = "/6355419/sample";
    const report = await s.service.getReport();
    expect(report.placements.find((row) => row.id === AdPlacementId.KNOWLEDGE_ARTICLE_END)).toMatchObject({ unitSource: "ENV", unitStatus: "CONFIGURED" });
    expect(report.placements.find((row) => row.id === AdPlacementId.NOTEBOOKS_OVERVIEW)).toMatchObject({ unitSource: "NONE", unitStatus: "MISSING" });
    expect(report.placements.find((row) => row.id === AdPlacementId.VISION_OVERVIEW)?.issues).toContain("TEST_UNIT");
    expect(JSON.stringify(report)).not.toContain("/123/legacy-private-unit");
  });
  it("reports configuration changes next time without claiming Google/content approval", async () => {
    const s = setup(); Object.assign(s.values, { "ads.enabled": true, "ads.display.enabled": true, "ads.placement.community_announcement_end.enabled": true,
      "ads.placement.community_announcement_end.ad_unit_path": "/123/configured" });
    const first = await s.service.getReport();
    expect(first.placements.find((row) => row.id === AdPlacementId.COMMUNITY_ANNOUNCEMENT_END)).toMatchObject({ issues: [], contentCheck: "REVIEWED_VIEW", authenticatedOnly: true });
    expect(first.externalVerification).toBe("NOT_CHECKED");
    s.values["ads.placement.community_announcement_end.ad_unit_path"] = "";
    expect((await s.service.getReport()).placements.find((row) => row.id === AdPlacementId.COMMUNITY_ANNOUNCEMENT_END)?.issues).toContain("UNIT_MISSING");
  });
  it("surfaces country/review gates and local sample mode separately", async () => {
    const s = setup(); s.values["ads.display.allowed_countries"] = "";
    Object.assign(s.env, { NODE_ENV: "development", APP_ENV: "development", APP_URL: "http://localhost:3000", ADS_LOCAL_TEST_ENABLED: "true" });
    const report = await s.service.getReport(); expect(report.localTestActive).toBe(true); expect(report.allowedCountries).toEqual([]);
    expect(report.placements.find((row) => row.id === AdPlacementId.COMMUNITY_OVERVIEW)?.issues).toContain("DISCOVERY_REVIEW_PENDING");
    expect(report.placements.every((row) => row.issues.includes("COUNTRIES_EMPTY"))).toBe(true);
    expect(report.placements.find((row) => row.id === AdPlacementId.FORUM_QUESTION_END)?.authenticatedOnly).toBe(false);
  });
  it.each(["javascript:alert(1)", "not-a-url"])("never returns unsafe site link %s", async (origin) => {
    const s = setup(); s.env.APP_URL = origin; expect((await s.service.getReport()).siteOrigin).toBeNull();
  });
  it("surfaces failed configuration reads instead of a false positive snapshot", async () => {
    const s = setup(); s.config.list.mockRejectedValue(new Error("Unavailable"));
    await expect(s.service.getReport()).rejects.toThrow("Unavailable");
  });
});

import { describe, expect, it, vi } from "vitest";
import { ExamType, type AdPlacementId } from "@mentor/types";
import { CONFIG_CATALOG } from "../../../common/config/config.catalog";
import { AdsService } from "./ads.service";

const OVERVIEWS = ["notebooks.overview", "vision.overview"] as AdPlacementId[];

function setup(options: { examType?: string | null; local?: boolean; production?: boolean } = {}) {
  const config: Record<string, string | number | boolean> = {
    "ads.enabled": true,
    "ads.display.enabled": true,
    "ads.display.allowed_countries": "TR",
    "ads.placement.knowledge_article_end.enabled": true,
    "ads.placement.knowledge_article_end.ad_unit_path": "",
    "ads.placement.notebooks_overview.enabled": true,
    "ads.placement.notebooks_overview.ad_unit_path": "/123/notebooks",
    "ads.placement.vision_overview.enabled": true,
    "ads.placement.vision_overview.ad_unit_path": "/123/vision",
  };
  const content = { getInfoArticleBySlug: vi.fn(async () => ({ family: ExamType.LGS })) };
  let premium = false;
  const service = new AdsService(
    {} as never,
    { get: async (key: string) => config[key] } as never,
    { get: (key: string) => ({
      NODE_ENV: options.production ? "production" : "development",
      APP_ENV: options.production ? "production" : "development",
      APP_URL: "http://localhost:3000",
      ADS_LOCAL_TEST_ENABLED: options.local ? "true" : "false",
      GAM_KNOWLEDGE_ARTICLE_END_AD_UNIT: "/123/legacy-blog",
    })[key] } as never,
    { getEntitlement: async (_id: string, roles: string[]) => ({ isPremium: premium || roles.includes("STAFF") }) } as never,
    { getDiscoveryProfile: async () => ({ examType: options.examType === undefined ? ExamType.YKS : options.examType }) } as never,
    {} as never,
    content as never,
    {} as never, {} as never, {} as never
  );
  return { service, config, content, setPremium: () => { premium = true; } };
}

describe.each(OVERVIEWS)("%s display placement", (placementId) => {
  const prefix = `ads.placement.${placementId.replace(".", "_")}`;
  const get = (service: AdsService, country: string | null = "TR", roles: string[] = []) =>
    service.getPlacement(placementId, "user", roles, null, country);

  it("blocks copied official test units in a production runtime", async () => {
    const { service, config } = setup({ production: true });
    config[`${prefix}.ad_unit_path`] = "/6355419/Travel/Europe/France/Paris";
    expect(await get(service)).toMatchObject({ enabled: false, reason: "TEST_INVENTORY_NOT_ALLOWED", adUnitPath: null });
  });

  it("uses server profile without looking up an article", async () => {
    const { service, content } = setup();
    expect(await get(service)).toMatchObject({
      id: placementId, enabled: true, audienceTreatment: "TEEN",
      sizes: [[250, 250], [300, 250]],
    });
    expect(content.getInfoArticleBySlug).not.toHaveBeenCalled();
  });

  it("applies changes on the next policy request", async () => {
    const { service, config } = setup();
    config[`${prefix}.ad_unit_path`] = "/456/replacement";
    expect(await get(service)).toMatchObject({ enabled: true, adUnitPath: "/456/replacement" });
    config[`${prefix}.enabled`] = false;
    expect(await get(service)).toMatchObject({ enabled: false, reason: "PLACEMENT_DISABLED" });
    config[`${prefix}.enabled`] = true;
    config[`${prefix}.ad_unit_path`] = "";
    expect(await get(service)).toMatchObject({ enabled: false, reason: "PROVIDER_NOT_CONFIGURED", adUnitPath: null });
  });

  it("is unavailable to anonymous readers", async () => {
    await expect(setup().service.getPublicPlacement(placementId, "real-blog", null, "TR"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([null, "", "UNKNOWN"])("rejects unverified profile context %s", async (examType) => {
    expect(await get(setup({ examType }).service)).toMatchObject({
      enabled: false, reason: "CONTEXT_UNVERIFIED", adUnitPath: null,
    });
  });

  it.each([["LGS", "CHILD"], ["YKS", "TEEN"], ["KPSS", "NONE"]])("preserves %s treatment", async (examType, audienceTreatment) => {
    expect(await get(setup({ examType }).service)).toMatchObject({ enabled: true, audienceTreatment });
  });

  it("keeps Premium and STAFF ad free", async () => {
    const { service, setPremium } = setup();
    expect(await get(service, "TR", ["STAFF"])).toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
    setPremium();
    expect(await get(service)).toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
  });

  it.each([[null, "REGION_NOT_ENABLED"], ["US", "REGION_NOT_ENABLED"], ["DE", "REGION_REQUIRES_CONSENT"]])("preserves country restriction %s", async (country, reason) => {
    expect(await get(setup().service, country)).toMatchObject({ enabled: false, reason });
  });

  it("uses only official inventory in local test mode", async () => {
    const { service, config } = setup({ local: true });
    config["ads.enabled"] = false;
    expect(await get(service, null)).toMatchObject({ enabled: true, adUnitPath: "/6355419/Travel/Europe/France/Paris" });
    expect(await get(service, "US")).toMatchObject({ enabled: false });
    expect(await get(service, null, ["STAFF"])).toMatchObject({ enabled: false });
  });

  it("does not override production flags with the local test switch", async () => {
    const { service, config } = setup({ local: true, production: true });
    config["ads.enabled"] = false;
    expect(await get(service)).toMatchObject({ enabled: false, reason: "GLOBAL_DISABLED" });
  });
});

describe("display unit configuration", () => {
  it("preserves the legacy blog unit until an admin configures an override", async () => {
    const { service, config } = setup();
    const get = () => service.getPublicPlacement("knowledge.article.end", "blog", null, "TR");
    expect(await get()).toMatchObject({ adUnitPath: "/123/legacy-blog" });
    config["ads.placement.knowledge_article_end.ad_unit_path"] = "/789/blog";
    expect(await get()).toMatchObject({ adUnitPath: "/789/blog" });
  });

  it.each(["notebooks_overview", "vision_overview"])("defaults %s to off", (name) => {
    expect(CONFIG_CATALOG[`ads.placement.${name}.enabled` as keyof typeof CONFIG_CATALOG]?.default).toBe(false);
  });

  it.each(["knowledge_article_end", "notebooks_overview", "vision_overview"])("validates the %s ad unit as a path, not executable code", (name) => {
    const entry = CONFIG_CATALOG[`ads.placement.${name}.ad_unit_path` as keyof typeof CONFIG_CATALOG];
    expect(entry).toBeDefined();
    for (const value of ["", "/123/unit", "/123,456/parent/unit-name_1"]) {
      expect(entry.schema.safeParse(value).success).toBe(true);
    }
    for (const value of ["https://evil.test", "<script>alert(1)</script>", "/123/unit?x=1", "/123/<script>", "javascript:alert(1)"]) {
      expect(entry.schema.safeParse(value).success).toBe(false);
    }
  });
});

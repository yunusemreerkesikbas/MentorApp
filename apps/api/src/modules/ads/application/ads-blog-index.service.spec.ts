import { describe, expect, it, vi } from "vitest";
import { ExamType, type AdPlacementId } from "@mentor/types";
import { adPlacementQuerySchema } from "@mentor/validation";
import { CONFIG_CATALOG } from "../../../common/config/config.catalog";
import { AdsService } from "./ads.service";

const INDEX = "knowledge.index" as AdPlacementId;

function setup(options: { empty?: boolean; featured?: boolean; family?: string; category?: string; description?: string; publishedAt?: string | null; profile?: string; premium?: boolean; local?: boolean } = {}) {
  const config: Record<string, unknown> = {
    "ads.enabled": true, "ads.display.enabled": true, "ads.display.allowed_countries": "TR",
    "ads.placement.knowledge_index.enabled": true,
    "ads.placement.knowledge_index.ad_unit_path": "/123/blog-index",
  };
  const summary = {
    slug: "published-guide", family: options.family ?? "LGS", category: options.category ?? "GENERAL",
    metaDescription: options.description ?? "An editorial explanation for exam preparation.",
    publishedAt: options.publishedAt === undefined ? "2026-10-01T00:00:00.000Z" : options.publishedAt,
  };
  const content = {
    listInfoArticles: vi.fn(async () => ({ items: options.empty ? [] : [summary], total: options.empty ? 0 : 1 })),
    getFeaturedArticle: vi.fn(async () => options.featured ? summary : null),
    getInfoArticleBySlug: vi.fn(),
  };
  const service = new AdsService(
    {} as never, { get: async (key: string) => config[key] } as never,
    { get: (key: string) => ({ NODE_ENV: "development", APP_URL: "http://localhost:3000", ADS_LOCAL_TEST_ENABLED: options.local ? "true" : "false" })[key] } as never,
    { getEntitlement: async (_id: string, roles: string[]) => ({ isPremium: Boolean(options.premium) || roles.includes("STAFF") }) } as never,
    { getDiscoveryProfile: async () => ({ examType: options.profile ?? "KPSS" }) } as never,
    {} as never, content as never, {} as never, {} as never, {} as never
  );
  return { service, config, content };
}

describe("blog index advertising", () => {
  it("verifies the selected listing rather than trusting the legacy exam or an article slug", async () => {
    const { service, content } = setup();
    expect(await service.getPublicPlacement(INDEX, "unrelated", ExamType.KPSS, "TR", { family: "LGS", category: "GENERAL", page: 2 }))
      .toMatchObject({ enabled: true, audienceTreatment: "CHILD", adUnitPath: "/123/blog-index" });
    expect(content.listInfoArticles).toHaveBeenCalledWith({ family: "LGS", category: "GENERAL", page: 2, pageSize: 12 });
    expect(content.getInfoArticleBySlug).not.toHaveBeenCalled();
  });

  it("denies a missing list context", async () => {
    expect(await setup().service.getPublicPlacement(INDEX, "published-guide", ExamType.LGS, "TR"))
      .toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED", adUnitPath: null });
  });

  it.each([{ empty: true }, { description: "  " }, { publishedAt: null }])("denies empty, links-only or unpublished content %j", async (options) => {
    expect(await setup(options).service.getPublicPlacement(INDEX, null, null, "TR", { family: "LGS", page: 1 }))
      .toMatchObject({ enabled: false, reason: "CONTEXT_UNVERIFIED", adUnitPath: null });
  });

  it("allows a featured-only first page but never a past-end page", async () => {
    const { service } = setup({ empty: true, featured: true });
    expect(await service.getPublicPlacement(INDEX, null, null, "TR", { family: "LGS", page: 1 })).toMatchObject({ enabled: true });
    expect(await service.getPublicPlacement(INDEX, null, null, "TR", { family: "LGS", page: 9 })).toMatchObject({ enabled: false });
    expect(await service.getPublicPlacement(INDEX, null, null, "TR", { family: "LGS", category: "APPLICATION", page: 1 })).toMatchObject({ enabled: false });
  });

  it("keeps Premium and STAFF ad-free", async () => {
    for (const [premium, roles] of [[true, []], [false, ["STAFF"]]] as const) {
      expect(await setup({ premium }).service.getPlacement(INDEX, "user", [...roles], null, "TR", { family: "LGS", page: 1 }))
        .toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
    }
  });

  it("uses the stricter authenticated profile when viewing adult content", async () => {
    expect(await setup({ family: "KPSS", profile: "LGS" }).service.getPlacement(INDEX, "user", [], null, "TR", { family: "KPSS", page: 1 }))
      .toMatchObject({ enabled: true, audienceTreatment: "CHILD" });
  });

  it("does not turn a failed content lookup into eligible inventory", async () => {
    const { service, content } = setup();
    content.listInfoArticles.mockRejectedValueOnce(new Error("Content unavailable"));
    await expect(service.getPublicPlacement(INDEX, null, null, "TR", { family: "LGS", page: 1 })).rejects.toThrow("Content unavailable");
  });

  it("applies unit and flag changes on the next request", async () => {
    const { service, config } = setup();
    const get = () => service.getPublicPlacement(INDEX, null, null, "TR", { family: "LGS", page: 1 });
    config["ads.placement.knowledge_index.ad_unit_path"] = "/456/new-index";
    expect(await get()).toMatchObject({ enabled: true, adUnitPath: "/456/new-index" });
    config["ads.placement.knowledge_index.ad_unit_path"] = "";
    expect(await get()).toMatchObject({ enabled: false, reason: "PROVIDER_NOT_CONFIGURED" });
    config["ads.placement.knowledge_index.enabled"] = false;
    expect(await get()).toMatchObject({ enabled: false, reason: "PLACEMENT_DISABLED" });
  });

  it("keeps country restrictions even in local sample mode", async () => {
    const { service } = setup({ local: true });
    expect(await service.getPublicPlacement(INDEX, null, null, null, { family: "LGS", page: 1 }))
      .toMatchObject({ enabled: true, adUnitPath: "/6355419/Travel/Europe/France/Paris" });
    expect(await service.getPublicPlacement(INDEX, null, null, "US", { family: "LGS", page: 1 })).toMatchObject({ enabled: false });
  });

  it("defaults off and validates listing query parameters", () => {
    expect(CONFIG_CATALOG["ads.placement.knowledge_index.enabled" as keyof typeof CONFIG_CATALOG]?.default).toBe(false);
    expect(adPlacementQuerySchema.parse({ family: "LGS", category: "GENERAL", page: "2" })).toMatchObject({ family: "LGS", category: "GENERAL", page: 2 });
    for (const query of [{ family: "INVALID" }, { category: "INVALID" }, { page: "-1" }]) {
      expect(adPlacementQuerySchema.safeParse(query).success).toBe(false);
    }
  });
});

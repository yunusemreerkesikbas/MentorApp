import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdPlacementId, type AdReadinessIssue, type AdReadinessPlacement, type AdReadinessReport } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { Env } from "../../../config/env.validation";
import { isLocalDisplayTestAllowed } from "../../../config/local-display-test";
import { AD_PLACEMENTS, PUBLIC_DISPLAY_PLACEMENTS } from "../domain/ads.constants";
import { isGoogleTestAdUnit, resolveAdUnit } from "../domain/ad-unit";

const CONTENT_CHECKS: Record<AdPlacementId, AdReadinessPlacement["contentCheck"] | null> = {
  "knowledge.article.end": "PUBLISHED_CONTENT", "knowledge.index": "PUBLISHED_CONTENT",
  "forum.question.end": "REVIEWED_VIEW", "community.question.end": "REVIEWED_VIEW",
  "community.announcement.end": "REVIEWED_VIEW", "community.overview": "PUBLIC_DISCOVERY",
  "notebooks.overview": "PROFILE", "vision.overview": "PROFILE", "dashboard.rewarded.coin": null,
};

/** Configuration only: no provider requests, user/content inspection, writes or inferred approvals. */
@Injectable()
export class AdsReadinessService {
  constructor(private readonly config: ConfigRegistryService, private readonly env: ConfigService<Env, true>) {}

  async getReport(): Promise<AdReadinessReport> {
    const values = new Map((await this.config.list()).map((entry) => [entry.key, entry.value]));
    const globalEnabled = values.get("ads.enabled") === true;
    const displayEnabled = values.get("ads.display.enabled") === true;
    const countries = values.get("ads.display.allowed_countries");
    const allowedCountries = typeof countries === "string" ? countries.split(",").filter(Boolean) : [];
    const placements: AdReadinessPlacement[] = Object.values(AD_PLACEMENTS).filter((placement) => placement.format === "DISPLAY").map((placement) => {
      const configured = placement.unitConfigKey ? values.get(placement.unitConfigKey) : undefined;
      const unit = resolveAdUnit(typeof configured === "string" ? configured : undefined, placement.envKey ? this.env.get(placement.envKey, { infer: true }) : undefined);
      const enabled = values.get(placement.configKey) === true;
      const unitStatus = !unit.path ? "MISSING" : isGoogleTestAdUnit(unit.path) ? "TEST_UNIT" : "CONFIGURED";
      const issues: AdReadinessIssue[] = [];
      if (!globalEnabled) issues.push("GLOBAL_DISABLED");
      if (!displayEnabled) issues.push("DISPLAY_DISABLED");
      if (!enabled) issues.push("PLACEMENT_DISABLED");
      if (unitStatus === "MISSING") issues.push("UNIT_MISSING");
      if (unitStatus === "TEST_UNIT") issues.push("TEST_UNIT");
      if (allowedCountries.length === 0) issues.push("COUNTRIES_EMPTY");
      if (placement.id === AdPlacementId.COMMUNITY_OVERVIEW && values.get("ads.placement.community_overview.review_approved") !== true) issues.push("DISCOVERY_REVIEW_PENDING");
      return { id: placement.id, enabled, unitSource: unit.source, unitStatus, issues,
        authenticatedOnly: !PUBLIC_DISPLAY_PLACEMENTS.has(placement.id), contentCheck: CONTENT_CHECKS[placement.id]! };
    });
    let siteOrigin: string | null = null;
    try {
      const url = new URL(this.env.get("APP_URL", { infer: true }));
      if (["http:", "https:"].includes(url.protocol)) siteOrigin = url.origin;
    } catch { /* Invalid configuration must not become an executable admin link. */ }
    return {
      checkedAt: new Date().toISOString(), environment: this.env.get("APP_ENV", { infer: true }) ??
        (this.env.get("NODE_ENV", { infer: true }) === "production" ? "production" : "development"),
      siteOrigin, globalEnabled, displayEnabled, allowedCountries, externalVerification: "NOT_CHECKED", placements,
      localTestActive: isLocalDisplayTestAllowed({ NODE_ENV: this.env.get("NODE_ENV", { infer: true }), APP_ENV: this.env.get("APP_ENV", { infer: true }),
        APP_URL: this.env.get("APP_URL", { infer: true }), ADS_LOCAL_TEST_ENABLED: this.env.get("ADS_LOCAL_TEST_ENABLED", { infer: true }) }),
    };
  }
}

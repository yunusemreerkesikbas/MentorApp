import { Injectable } from "@nestjs/common";
import {
  PREMIUM_FEATURE_IDS,
  type FeaturePolicyDto,
  type PremiumFeatureId,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { ConfigKey } from "../../../common/config/config.catalog";
import { PREMIUM_FEATURE_CATALOG } from "../domain/feature-access";

@Injectable()
export class FeaturePolicyService {
  constructor(private readonly config: ConfigRegistryService) {}

  async listPolicies(): Promise<Record<PremiumFeatureId, FeaturePolicyDto>> {
    const entries = await Promise.all(
      PREMIUM_FEATURE_IDS.map(async (id) => {
        const meta = PREMIUM_FEATURE_CATALOG[id];
        const [freeEnabled, limit] = await Promise.all([
          this.config.get(meta.enabledKey as ConfigKey),
          this.config.get(meta.limitKey as ConfigKey),
        ]);
        const policy: FeaturePolicyDto = {
          id,
          freeEnabled: Boolean(freeEnabled),
          limit: Number(limit),
          window: meta.window,
        };
        return [id, policy] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<PremiumFeatureId, FeaturePolicyDto>;
  }
}

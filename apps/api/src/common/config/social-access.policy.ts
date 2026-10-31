import { Injectable } from "@nestjs/common";
import { NotFoundError } from "../errors/domain-error";
import { ConfigRegistryService } from "./config-registry.service";

/** Identity relations can close independently of forum maintenance and personal progress. */
@Injectable()
export class SocialAccessPolicy {
  constructor(private readonly config: ConfigRegistryService) {}

  isEnabled(): Promise<boolean> {
    return this.config.get("community.social.enabled");
  }

  async assertEnabled(): Promise<void> {
    if (!(await this.isEnabled())) throw new NotFoundError();
  }

  async assertSelfOrEnabled(viewerId: string, ownerId: string): Promise<void> {
    if (viewerId !== ownerId) await this.assertEnabled();
  }
}

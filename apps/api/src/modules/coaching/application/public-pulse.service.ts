import { Injectable } from "@nestjs/common";
import type { PublicPulseView } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { PublicPulseRepository } from "../infrastructure/public-pulse.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The landing's "Son 24 saatte {n} kişi burada çalıştı", or nothing while the number is small. */
@Injectable()
export class PublicPulseService {
  constructor(
    private readonly pulse: PublicPulseRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  async get(now = new Date()): Promise<PublicPulseView> {
    const [minPeople, people] = await Promise.all([
      this.config.get("coaching.public_pulse.min_people"),
      this.pulse.studiedSince(new Date(now.getTime() - DAY_MS)),
    ]);
    return { studiedLast24h: people >= minPeople ? people : null };
  }
}

import { Injectable } from "@nestjs/common";
import type { EconomyUseView } from "@mentor/types";

export type AiUsesResolver = (
  userId: string,
  roles: string[],
  coin: number,
) => Promise<EconomyUseView[]>;

/** AI imports economy, so AI registers its read-only view instead of a reverse module import. */
@Injectable()
export class EconomyUsesRegistry {
  private resolver: AiUsesResolver | null = null;
  register(resolver: AiUsesResolver): void {
    this.resolver = resolver;
  }
  resolve(
    userId: string,
    roles: string[],
    coin: number,
  ): Promise<EconomyUseView[]> {
    if (this.resolver) return this.resolver(userId, roles, coin);
    // An absent AI module must never advertise usable paid generation (isolated module tests).
    return Promise.resolve(
      (["COACH_CHAT", "DEEP_ANALYSIS"] as const).map((id) => ({
        id,
        status: "UNAVAILABLE",
        cost: null,
        premiumIncluded: false,
        canOpen: false,
      })),
    );
  }
}

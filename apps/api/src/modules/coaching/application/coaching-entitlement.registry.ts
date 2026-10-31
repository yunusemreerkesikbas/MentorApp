import { Injectable } from "@nestjs/common";

export type IsPremiumResolver = (
  userId: string,
  rolesHint?: string[],
) => Promise<boolean>;

/**
 * "Does this user hold active Premium access?" for coaching quota gates.
 *
 * Payments owns subscription entitlement, and `PaymentsModule` already imports `CoachingModule`
 * (for `StreakService`), so coaching cannot import payments back without a cycle. Mirrors
 * `InviteSignalRegistry`: `EntitlementService` registers its resolver here at boot, and coaching
 * asks without knowing who answers. When nothing is registered (isolated unit tests), defaults to
 * `false` (Free tier) so limits are still exercised by default.
 */
@Injectable()
export class CoachingEntitlementRegistry {
  private resolver: IsPremiumResolver | null = null;
  private notebookSlotResolver: ((userId: string) => Promise<number>) | null = null;

  /** Economy registers its durable ledger-backed capacity without a module cycle. */
  registerNotebookSlots(resolver: (userId: string) => Promise<number>): void {
    this.notebookSlotResolver = resolver;
  }

  async notebookSlots(userId: string): Promise<number> {
    return this.notebookSlotResolver ? this.notebookSlotResolver(userId) : 0;
  }

  register(resolver: IsPremiumResolver): void {
    this.resolver = resolver;
  }

  async isPremium(userId: string, rolesHint?: string[]): Promise<boolean> {
    return this.resolver ? this.resolver(userId, rolesHint) : false;
  }
}

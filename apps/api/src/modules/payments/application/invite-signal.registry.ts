import { Injectable } from "@nestjs/common";

/** When this user redeemed a friend's invite code, or null. */
export type InvitedAtResolver = (userId: string) => Promise<Date | null>;

/**
 * "Did this user come through a friend's invite, and when?" for the INVITED promotion rule.
 *
 * Economy owns invites, but `EconomyModule` already imports `PaymentsModule`, so payments cannot
 * import economy back (cycle). Economy registers its resolver here at boot instead; payments asks
 * without knowing who answers. Nothing registered (economy not loaded) → null → the INVITED rule
 * matches nobody, and checkout carries on at the price every other rule gives.
 */
@Injectable()
export class InviteSignalRegistry {
  private resolver: InvitedAtResolver | null = null;

  register(resolver: InvitedAtResolver): void {
    this.resolver = resolver;
  }

  async invitedAt(userId: string): Promise<Date | null> {
    return this.resolver ? this.resolver(userId) : null;
  }
}

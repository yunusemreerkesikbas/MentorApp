import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Currency } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { EconomyService } from "./economy.service";
import { InviteRepository } from "../infrastructure/invite.repository";

export interface InviteSummary {
  code: string | null;
  invited: number;
  converted: number;
}

const genCode = (): string => `MENTOR-${randomBytes(6).toString("hex").toUpperCase()}`;

/**
 * Invite → conversion → coin (§3 light economy slice 2a). Reward fires ONLY when an invited user's
 * subscription activates (forward-only, verified). Reward goes to the inviter; idempotent + capped.
 */
@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly repo: InviteRepository,
    private readonly entitlement: EntitlementService,
    private readonly economy: EconomyService,
    private readonly config: ConfigRegistryService,
  ) {}

  /** The user's stable invite code (created on first request). */
  async getOrCreateCode(userId: string): Promise<string> {
    const existing = await this.repo.findByInviter(userId);
    if (existing) return existing.code;
    for (let i = 0; i < 5; i++) {
      const code = genCode();
      if (!(await this.repo.findByCode(code))) {
        return (await this.repo.create(userId, code)).code;
      }
    }
    throw new DomainError(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /** Redeem a code (post-signup). Forward-only + new-user guards; reward happens on conversion. */
  async redeem(invitedUserId: string, code: string): Promise<{ status: string }> {
    const invite = await this.repo.findByCode(code);
    if (!invite) throw new DomainError(ErrorCode.INVITE_CODE_INVALID, HttpStatus.NOT_FOUND);
    if (invite.inviterUserId === invitedUserId) {
      throw new DomainError(ErrorCode.INVITE_SELF, HttpStatus.BAD_REQUEST);
    }
    if (await this.repo.findRedemptionByInvited(invitedUserId)) {
      throw new DomainError(ErrorCode.INVITE_ALREADY_REDEEMED, HttpStatus.CONFLICT);
    }
    const ent = await this.entitlement.getEntitlement(invitedUserId);
    if (ent.isPremium) throw new DomainError(ErrorCode.INVITE_ALREADY_PREMIUM, HttpStatus.CONFLICT);

    const redemption = await this.repo.createRedemption(invite.inviterUserId, invitedUserId, code);
    // Race: a concurrent redeem inserted first (unique invited) → onConflictDoNothing returned none.
    if (!redemption) throw new DomainError(ErrorCode.INVITE_ALREADY_REDEEMED, HttpStatus.CONFLICT);
    return { status: redemption.status };
  }

  /**
   * On the invited user's subscription activation: flip PENDING→CONVERTED (idempotent) and reward
   * the inviter. Called by the payments-event listener. Reward is capped via EconomyService.
   */
  async onInvitedConverted(invitedUserId: string): Promise<void> {
    const redemption = await this.repo.markConverted(invitedUserId);
    if (!redemption) return; // no pending redemption → nothing to reward (idempotent)
    const reward = await this.config.get("economy.invite.reward_coin");
    if (reward <= 0) return;
    // Conversion is a fact (already marked CONVERTED); the reward is best-effort within the coin caps.
    // A cap denial is the abuse shield working as intended (info, not an error). Other failures are
    // logged but swallowed so this event listener never throws uncaught (reconcile = backlog/outbox).
    try {
      await this.economy.grant(redemption.inviterUserId, Currency.COIN, reward, {
        reason: "invite.converted",
        refType: "invite-redemption",
        refId: redemption.id,
        enforceLimits: true,
      });
    } catch (err) {
      if (err instanceof DomainError && err.code === ErrorCode.ECONOMY_LIMIT_EXCEEDED) {
        this.logger.log(
          { inviterUserId: redemption.inviterUserId, redemptionId: redemption.id },
          "invite reward skipped — inviter over coin cap",
        );
      } else {
        this.logger.error(
          { err, inviterUserId: redemption.inviterUserId, redemptionId: redemption.id },
          "invite reward failed (conversion recorded, reward not granted)",
        );
      }
    }
  }

  async summary(inviterUserId: string): Promise<InviteSummary> {
    const invite = await this.repo.findByInviter(inviterUserId);
    const counts = await this.repo.countsByInviter(inviterUserId);
    return { code: invite?.code ?? null, ...counts };
  }
}

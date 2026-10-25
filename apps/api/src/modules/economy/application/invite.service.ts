import { PaymentEvidenceService } from "../../payments/application/payment-evidence.service";
import { InviteSignalRegistry } from "../../payments/application/invite-signal.registry";
import { SubscriptionsService } from "../../payments/application/subscriptions.service";
import type { PaymentSucceeded } from "../../payments/domain/payments.events";
import { HttpStatus, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { randomInt } from "node:crypto";
import { Currency, UserRole } from "@mentor/types";
import type { InviteCodeView, InviteDiscountView, InvitePreviewView } from "@mentor/types";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { BuddyService } from "../../identity/application/buddy.service";
import { FollowService } from "../../identity/application/follow.service";
import { UsersService } from "../../identity/application/users.service";
import { UsersRepository, type UserRow } from "../../identity/infrastructure/users.repository";
import { EconomyService } from "./economy.service";
import { QuestService } from "./quest.service";
import { EconomyLedger } from "../domain/economy.constants";
import { EconomyEventTopic, type InviteRedeemed } from "../domain/economy.events";
import { InviteRepository, type InviteRow } from "../infrastructure/invite.repository";

export interface InviteSummary {
  code: string | null;
  invited: number;
  converted: number;
}

/** No 0/O/1/I: a code read off a screen or shared by voice must survive being retyped. */
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 8;

export const generateInviteCode = (): string => {
  let suffix = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    suffix += INVITE_CODE_ALPHABET.charAt(randomInt(INVITE_CODE_ALPHABET.length));
  }
  return `PUHU-${suffix}`;
};

const DAY_MS = 86_400_000;

/** How many joined friends the inviter's card lists. */
const JOINED_LIST_LIMIT = 20;

/** Why a user cannot redeem a code right now (all three are a 409 on redeem). */
interface RedeemBlock {
  code: ErrorCode;
  details?: Record<string, unknown>;
}

const isCoach = (user: Pick<UserRow, "roles">): boolean => user.roles.includes(UserRole.COACH);

/**
 * Invite → conversion → coin (§3 light economy slice 2a). Reward fires ONLY when an invited user's
 * first positive payment succeeds (forward-only, verified). Reward goes to the inviter; idempotent + capped.
 */
@Injectable()
export class InviteService implements OnModuleInit {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly repo: InviteRepository,
    private readonly economy: EconomyService,
    private readonly quests: QuestService,
    private readonly config: ConfigRegistryService,
    private readonly paymentEvidence: PaymentEvidenceService,
    private readonly users: UsersRepository,
    private readonly buddy: BuddyService,
    private readonly follows: FollowService,
    private readonly events: EventEmitter2,
    private readonly inviteSignals: InviteSignalRegistry,
    private readonly identities: UsersService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * Hand payments the "came through an invite, and when" signal for the INVITED promotion rule.
   * Payments cannot import economy (economy imports payments), so it asks this resolver through
   * its registry. A switched-off economy answers null: a dormant invite programme never discounts.
   */
  onModuleInit(): void {
    this.inviteSignals.register(async (userId) => {
      if (!(await this.config.get("economy.enabled"))) return null;
      return (await this.repo.findRedemptionByInvited(userId))?.redeemedAt ?? null;
    });
  }

  /** The user's stable invite code (created on first request). */
  async getOrCreateCode(userId: string): Promise<string> {
    const existing = await this.repo.findByInviter(userId);
    if (existing) return existing.code;
    for (let i = 0; i < 5; i++) {
      const code = generateInviteCode();
      if (!(await this.repo.findByCode(code))) {
        return (await this.repo.create(userId, code)).code;
      }
    }
    throw new DomainError(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * The code's invite and owner, or undefined when the code cannot be used: unknown, or the owner is
   * gone, not an active account (suspended, banned, anonymized, mid-erasure) or has become a coach.
   * One place for "is this code usable", shared by redeem and the public preview.
   */
  private async resolveValidInvite(code: string): Promise<{ invite: InviteRow; owner: UserRow } | undefined> {
    const invite = await this.repo.findByCode(code);
    if (!invite) return undefined;
    const owner = await this.users.findByIdService(invite.inviterUserId);
    if (!owner || owner.status !== "ACTIVE" || owner.erasureStartedAt || isCoach(owner)) return undefined;
    return { invite, owner };
  }

  /**
   * What stops this user from redeeming any code right now, or null when nothing does. Check order:
   * not already redeemed, inside the signup window, never paid (a trial alone does not count). One
   * definition, shared by `redeem` (which throws it) and the card's `canRedeem` (which reports it).
   */
  private async redeemBlock(invited: Pick<UserRow, "id" | "createdAt">): Promise<RedeemBlock | null> {
    if (await this.repo.findRedemptionByInvited(invited.id)) return { code: ErrorCode.INVITE_ALREADY_REDEEMED };
    const days = await this.config.get("economy.invite.redeem_window_days");
    if (Date.now() - invited.createdAt.getTime() > days * DAY_MS) {
      return { code: ErrorCode.INVITE_WINDOW_CLOSED, details: { days } };
    }
    if (await this.paymentEvidence.hasPaid(invited.id)) return { code: ErrorCode.INVITE_ALREADY_PAID };
    return null;
  }

  /**
   * Redeem a code (post-signup). Forward-only + new-user guards; reward happens on conversion.
   * Check order: usable code → not self → redeemer not a coach → not already redeemed → inside the
   * signup window → never paid (a trial alone does not count).
   */
  async redeem(invitedUserId: string, code: string): Promise<{ status: string }> {
    const resolved = await this.resolveValidInvite(code);
    if (!resolved) throw new DomainError(ErrorCode.INVITE_CODE_INVALID, HttpStatus.NOT_FOUND);
    const { invite } = resolved;
    if (invite.inviterUserId === invitedUserId) {
      throw new DomainError(ErrorCode.INVITE_SELF, HttpStatus.BAD_REQUEST);
    }
    const invited = await this.users.findByIdService(invitedUserId);
    if (!invited) throw new NotFoundError();
    if (isCoach(invited)) throw new DomainError(ErrorCode.INVITE_COACH_NOT_ALLOWED, HttpStatus.FORBIDDEN);
    const block = await this.redeemBlock(invited);
    if (block) throw new DomainError(block.code, HttpStatus.CONFLICT, block.details);

    const redemption = await this.repo.createRedemption(invite.inviterUserId, invitedUserId, code);
    // Race: a concurrent redeem inserted first (unique invited) → onConflictDoNothing returned none.
    if (!redemption) throw new DomainError(ErrorCode.INVITE_ALREADY_REDEEMED, HttpStatus.CONFLICT);
    // The invited user just satisfied the "invite-redeemed" onboarding quest — grant inline (idempotent).
    // Best-effort: the redemption is already committed, so a quest-eval failure must NOT fail the redeem.
    try {
      await this.quests.evaluateAndGrant(invitedUserId);
    } catch (err) {
      this.logger.error({ err, invitedUserId }, "quest eval after redeem failed (redemption recorded)");
    }
    await this.connectAfterRedeem(redemption.id, invite.inviterUserId, invited);
    return { status: redemption.status };
  }

  /**
   * Side effects of a redeem that WON the insert (the loser of a race never gets here): link the two as
   * study buddies (invited asks inviter), or follow each other when either already has a pairing; then
   * emit INVITE_REDEEMED so the inviter hears about it. Best-effort end to end: the redemption is already
   * committed, so no failure here may fail the redeem. A failed buddy request counts as "not requested",
   * which keeps the inviter's single notification honest (the joined one) and still tries the follow.
   */
  private async connectAfterRedeem(redemptionId: string, inviterUserId: string, invited: UserRow): Promise<void> {
    let buddyRequested = false;
    try {
      buddyRequested = await this.buddy.requestFromInvite(invited.id, inviterUserId);
    } catch (err) {
      this.logger.warn({ err, redemptionId }, "invite buddy request failed (redemption recorded)");
    }
    if (!buddyRequested) {
      try {
        await this.follows.followEachOtherSilently(invited.id, inviterUserId);
      } catch (err) {
        this.logger.warn({ err, redemptionId }, "invite mutual follow failed (redemption recorded)");
      }
    }
    const payload: InviteRedeemed = {
      redemptionId,
      inviterUserId,
      invitedUserId: invited.id,
      invitedDisplayName: invited.displayName,
      buddyRequested,
    };
    try {
      this.events.emit(EconomyEventTopic.INVITE_REDEEMED, payload);
    } catch (err) {
      this.logger.warn({ err, redemptionId }, "invite redeemed event failed (redemption recorded)");
    }
  }

  /**
   * On the invited user's first positive successful payment: flip PENDING→CONVERTED (idempotent) and reward
   * the inviter. Called by the payments-event listener. Reward is capped via EconomyService.
   */
  async onInvitedConverted(event: PaymentSucceeded): Promise<void> {
    if (event.amountMinor <= 0) return;
    const reward = await this.config.get("economy.invite.reward_coin");
    await this.repo.withServiceTx(async (tx) => {
      const redemption = await this.repo.lockPending(event.userId, tx);
      if (!redemption || redemption.redeemedAt > event.paidAt) return;
      if (await this.paymentEvidence.isRefunded(event.userId, event.paymentId)) {
        await this.repo.recordPayment(redemption.id, event.paymentId, "REFUNDED", tx);
        return;
      }
      // Coaches are outside the invite economy; a role gained after the redeem is caught here.
      const [inviter, invited] = await Promise.all([
        this.users.findByIdService(redemption.inviterUserId),
        this.users.findByIdService(redemption.invitedUserId),
      ]);
      if ((inviter && isCoach(inviter)) || (invited && isCoach(invited))) {
        await this.repo.recordPayment(redemption.id, event.paymentId, "COACH_SKIPPED", tx);
        return;
      }
      let outcome = reward > 0 ? "GRANTED" : "DISABLED";
      if (reward > 0) {
        try {
          await this.economy.grantInServiceTx(redemption.inviterUserId, Currency.COIN, reward, {
            reason: EconomyLedger.INVITE_CONVERTED_REASON,
            refType: EconomyLedger.INVITE_REF_TYPE, refId: redemption.id,
          }, tx);
        } catch (err) {
          if (!(err instanceof DomainError) || err.code !== ErrorCode.ECONOMY_LIMIT_EXCEEDED) throw err;
          outcome = "CAP_DENIED";
        }
      }
      await this.repo.recordPayment(redemption.id, event.paymentId, outcome, tx);
    });
  }

  /**
   * On refund of the invited user's charge: compensating reversal of the inviter's conversion
   * reward. Refund-only policy — a period-end cancel keeps the reward (the period was paid).
   * Clamp-to-zero + idempotent (EconomyService.reverse). Called by the refund-event listener.
   */
  async onInvitedRefunded(invitedUserId: string, sourcePaymentId?: string): Promise<void> {
    await this.repo.withServiceTx(async (tx) => {
    const redemption = await this.repo.lockRedemption(invitedUserId, tx);
    if (!sourcePaymentId || !redemption || redemption.status !== "CONVERTED" || redemption.sourcePaymentId !== sourcePaymentId || redemption.rewardOutcome !== "GRANTED") return;
    try {
      const reversed = await this.economy.reverseInServiceTx(redemption.inviterUserId, {
        originalRefType: EconomyLedger.INVITE_REF_TYPE,
        originalRefId: redemption.id,
        reason: EconomyLedger.INVITE_REVERSAL_REASON,
        refType: EconomyLedger.INVITE_REVERSAL_REF_TYPE,
        refId: redemption.id,
      }, tx);
      // Persist settlement even if nothing remained to debit. A replay must not claw back
      // unrelated Coin earned later when the original reward had already been spent.
      await this.repo.markRewardReversed(redemption.id, tx);
      if (reversed > 0) {
        this.logger.log(
          { inviterUserId: redemption.inviterUserId, redemptionId: redemption.id, reversed },
          "invite reward reversed on refund",
        );
      }
    } catch (err) {
      // Propagate to the payment outbox job so a transient failure is retried.
      this.logger.error(
        { err, inviterUserId: redemption.inviterUserId, redemptionId: redemption.id },
        "invite reward reversal failed",
      );
      throw err;
    }
    });
  }

  /**
   * The user's own invite card: their code, how their invites are going, and, when a friend invited
   * them, who and what discount that earns. Everything the card needs in one read.
   */
  async getView(userId: string): Promise<InviteCodeView> {
    const user = await this.users.findByIdService(userId);
    if (!user) throw new NotFoundError();
    const [code, rewardCoin, joinedRows, convertedCount, redemption, economyEnabled, block] = await Promise.all([
      this.getOrCreateCode(userId),
      this.config.get("economy.invite.reward_coin"),
      this.repo.listJoinedByInviter(userId, JOINED_LIST_LIMIT),
      this.repo.countConvertedByInviter(userId),
      this.repo.findRedemptionByInvited(userId),
      this.config.get("economy.enabled"),
      this.redeemBlock(user),
    ]);
    return {
      code,
      rewardCoin,
      joined: await this.joinedFriends(joinedRows.map((row) => row.invitedUserId)),
      convertedCount,
      redeemed: redemption ? await this.redeemedView(userId, redemption.inviterUserId) : null,
      canRedeem: economyEnabled && block === null,
    };
  }

  /** Display names only, in the order given. A friend whose identity cannot be resolved is left out, not replaced by a placeholder. */
  private async joinedFriends(invitedUserIds: string[]): Promise<{ displayName: string }[]> {
    if (invitedUserIds.length === 0) return [];
    const identities = await this.identities.listDisplayIdentities(invitedUserIds);
    return invitedUserIds.flatMap((id) => {
      const displayName = identities.get(id)?.displayName.trim();
      return displayName ? [{ displayName }] : [];
    });
  }

  private async redeemedView(userId: string, inviterUserId: string): Promise<NonNullable<InviteCodeView["redeemed"]>> {
    const [identities, discount] = await Promise.all([
      this.identities.listDisplayIdentities([inviterUserId]),
      this.inviteDiscountFor(userId),
    ]);
    return { inviterDisplayName: identities.get(inviterUserId)?.displayName ?? "", discount };
  }

  /**
   * The friend discount as THIS user should be told about it: only what web checkout will honour.
   * A verified phone: exactly what checkout would resolve now. Without one the INVITED rule cannot
   * apply yet, so the card says "verify to get it", but only to someone who could then check out
   * (no open subscription) and still qualifies (never paid).
   */
  private async inviteDiscountFor(userId: string): Promise<InviteDiscountView | null> {
    if (await this.identities.isPhoneVerified(userId)) {
      const promotion = (await this.subscriptions.findInviteOffer(userId))?.promotion;
      return promotion
        ? { discountType: promotion.discountType, discountValue: promotion.discountValue, phoneRequired: false }
        : null;
    }
    const preview = await this.subscriptions.previewInviteOffer();
    if (!preview) return null;
    const [blocked, paid] = await Promise.all([
      this.subscriptions.hasCheckoutBlockingSubscription(userId),
      this.paymentEvidence.hasPaid(userId),
    ]);
    return blocked || paid
      ? null
      : { discountType: preview.discountType, discountValue: preview.discountValue, phoneRequired: true };
  }

  /**
   * What a friend sees on the public invite link. One "invalid" answer covers every unusable code
   * (unknown, coach, anonymized or erasing owner) and a switched-off economy, so the landing cannot
   * be used to probe which of those it is. Only the inviter's display name leaves: no username,
   * avatar or id.
   */
  async getPreview(code: string): Promise<InvitePreviewView> {
    const invalid = () => new DomainError(ErrorCode.INVITE_CODE_INVALID, HttpStatus.NOT_FOUND);
    if (!(await this.config.get("economy.enabled"))) throw invalid();
    const resolved = await this.resolveValidInvite(code);
    if (!resolved) throw invalid();
    const offer = await this.subscriptions.previewInviteOffer();
    return {
      inviterDisplayName: resolved.owner.displayName,
      discount: offer ? { discountType: offer.discountType, discountValue: offer.discountValue } : null,
    };
  }

  /** Admin per-user economy view (invite counts only; the user-facing card is {@link getView}). */
  async summary(inviterUserId: string): Promise<InviteSummary> {
    const invite = await this.repo.findByInviter(inviterUserId);
    const counts = await this.repo.countsByInviter(inviterUserId);
    return { code: invite?.code ?? null, ...counts };
  }

  /** Admin metrics (W6) — global invite totals across all users. */
  getGlobalStats(): Promise<{ invited: number; converted: number }> {
    return this.repo.conversionStatsGlobal();
  }
}

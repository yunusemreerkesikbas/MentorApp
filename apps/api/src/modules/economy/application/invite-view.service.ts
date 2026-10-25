import { HttpStatus, Injectable } from "@nestjs/common";
import type { InviteCodeView, InviteDiscountView, InvitePreviewView } from "@mentor/types";
import { PaymentEvidenceService } from "../../payments/application/payment-evidence.service";
import { SubscriptionsService } from "../../payments/application/subscriptions.service";
import { UsersService } from "../../identity/application/users.service";
import { UsersRepository } from "../../identity/infrastructure/users.repository";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { InviteRepository } from "../infrastructure/invite.repository";
import { InviteService } from "./invite.service";

/** How many joined friends the inviter's card lists. */
const JOINED_LIST_LIMIT = 20;

/**
 * The read-only side of the invite flow: the user's own card and the public preview. `InviteService`
 * owns the rules (is a code usable, can this user still redeem); this only asks it, so the card and
 * `redeem` can never disagree. Nothing here writes.
 */
@Injectable()
export class InviteViewService {
  constructor(
    private readonly invites: InviteService,
    private readonly repo: InviteRepository,
    private readonly config: ConfigRegistryService,
    private readonly paymentEvidence: PaymentEvidenceService,
    private readonly users: UsersRepository,
    private readonly identities: UsersService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * The user's own invite card: their code, how their invites are going, and, when a friend invited
   * them, who and what discount that earns. Everything the card needs in one read.
   */
  async getView(userId: string): Promise<InviteCodeView> {
    const user = await this.users.findByIdService(userId);
    if (!user) throw new NotFoundError();
    const [code, rewardCoin, joinedRows, convertedCount, redemption, economyEnabled, block] = await Promise.all([
      this.invites.getOrCreateCode(userId),
      this.config.get("economy.invite.reward_coin"),
      this.repo.listJoinedByInviter(userId, JOINED_LIST_LIMIT),
      this.repo.countConvertedByInviter(userId),
      this.repo.findRedemptionByInvited(userId),
      this.config.get("economy.enabled"),
      this.invites.redeemBlock(user),
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

  /**
   * Display names only, in the order given. A friend who is not a live account is left out, never
   * replaced by a placeholder: no row, a blank name, or an inactive one. Erasure anonymizes and KEEPS
   * the row ("Silinmiş Kullanıcı"), so the row's presence says nothing; `active` does.
   */
  private async joinedFriends(invitedUserIds: string[]): Promise<{ displayName: string }[]> {
    if (invitedUserIds.length === 0) return [];
    const identities = await this.identities.listDisplayIdentities(invitedUserIds);
    return invitedUserIds.flatMap((id) => {
      const person = identities.get(id);
      const displayName = person?.active ? person.displayName.trim() : "";
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
    const resolved = await this.invites.resolveValidInvite(code);
    if (!resolved) throw invalid();
    const offer = await this.subscriptions.previewInviteOffer();
    return {
      inviterDisplayName: resolved.owner.displayName,
      discount: offer ? { discountType: offer.discountType, discountValue: offer.discountValue } : null,
    };
  }
}

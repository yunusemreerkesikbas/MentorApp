import type { CommunityLevelView } from "@mentor/types";

export const EconomyEventTopic = {
  XP_CHANGED: "economy.xp.changed",
  /** A friend redeemed an invite code (only the winning insert emits) -> the inviter is told. */
  INVITE_REDEEMED: "economy.invite.redeemed",
} as const;

/**
 * `buddyRequested` = a study-buddy request invited -> inviter went out with this redeem; that request's
 * own notification already tells the inviter, so the invite listener stays quiet in that case.
 */
export interface InviteRedeemed {
  redemptionId: string;
  inviterUserId: string;
  invitedUserId: string;
  invitedDisplayName: string;
  buddyRequested: boolean;
}

export interface EconomyXpChanged {
  userId: string;
  level: CommunityLevelView;
  occurredAt: Date;
}

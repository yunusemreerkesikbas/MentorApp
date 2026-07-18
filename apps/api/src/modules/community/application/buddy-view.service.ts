import { Inject, Injectable } from "@nestjs/common";
import type { BuddyRequestRef, BuddyUserRef, BuddyViewDto } from "@mentor/types";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { SessionService } from "../../coaching/application/session.service";
import { StreakService } from "../../coaching/application/streak.service";
import {
  BUDDY_NUDGE_COOLDOWN_MS,
  BuddyService,
  type BuddyPairWithUserRow,
} from "../../identity/application/buddy.service";

/**
 * Composes GET /v1/buddy: pairing state from identity + the partner's TODAY effort
 * from coaching public services. Effort only (focus minutes, streak) — NEVER exam
 * results (§4 "çabada rekabet, sonuçta asla"). Community owns no tables (APP-017 precedent).
 */
@Injectable()
export class BuddyViewService {
  constructor(
    private readonly buddy: BuddyService,
    private readonly sessions: SessionService,
    private readonly streak: StreakService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  /** Same-cohort buddy suggestions for the /seans empty-state list (public-safe refs). */
  async getSuggestions(userId: string, limit: number): Promise<BuddyUserRef[]> {
    const candidates = await this.buddy.getSuggestionCandidates(userId, limit);
    return candidates.map((c) => ({
      userId: c.userId,
      displayName: c.displayName,
      username: c.username,
      avatarUrl: c.avatarStorageKey ? this.storage.getPublicUrl(c.avatarStorageKey) : null,
    }));
  }

  async getView(userId: string): Promise<BuddyViewDto> {
    const [active, outgoing, incoming] = await Promise.all([
      this.buddy.getActivePair(userId),
      this.buddy.getOutgoingPending(userId),
      this.buddy.listIncomingPending(userId),
    ]);

    if (!active) {
      return {
        active: null,
        outgoing: outgoing ? this.toRequestRef(outgoing) : null,
        incoming: incoming.map((r) => this.toRequestRef(r)),
      };
    }

    const partnerId = active.otherUserId;
    const [focusMinutesToday, currentStreak, partnerStudyingNow] = await Promise.all([
      this.sessions.getTodayFocusMinutes(partnerId),
      this.streak.getCurrentStreak(partnerId),
      this.sessions.isStudyingNow(partnerId),
    ]);
    const myLastNudgeAt =
      active.requesterId === userId ? active.requesterLastNudgeAt : active.addresseeLastNudgeAt;
    const cooldownEndsAt = myLastNudgeAt
      ? new Date(myLastNudgeAt.getTime() + BUDDY_NUDGE_COOLDOWN_MS)
      : null;
    const canNudge = !cooldownEndsAt || cooldownEndsAt.getTime() <= Date.now();

    return {
      active: {
        pairId: active.id,
        partner: this.toUserRef(active),
        focusMinutesToday,
        currentStreak,
        partnerStudyingNow,
        canNudge,
        nudgeCooldownEndsAt: canNudge ? null : cooldownEndsAt!.toISOString(),
      },
      // With an active pairing there are no other rows (accept tx clears them).
      outgoing: null,
      incoming: [],
    };
  }

  private toUserRef(row: BuddyPairWithUserRow): BuddyUserRef {
    return {
      userId: row.otherUserId,
      displayName: row.otherDisplayName,
      username: row.otherUsername,
      avatarUrl: row.otherAvatarStorageKey
        ? this.storage.getPublicUrl(row.otherAvatarStorageKey)
        : null,
    };
  }

  private toRequestRef(row: BuddyPairWithUserRow): BuddyRequestRef {
    return {
      id: row.id,
      partner: this.toUserRef(row),
      createdAt: row.createdAt.toISOString(),
    };
  }
}

import { Inject, Injectable } from "@nestjs/common";
import type {
  BuddyRequestRef,
  BuddySuggestionRef,
  BuddyUserRef,
  BuddyViewDto,
} from "@mentor/types";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { SessionService } from "../../coaching/application/session.service";
import { StreakService } from "../../coaching/application/streak.service";
import { UsersRepository } from "../../identity/infrastructure/users.repository";
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
/** How far back a shared session still counts as a reason to pair up. */
const BUDDY_SUGGESTION_WINDOW_DAYS = 60;
/** Over-fetch so the ranked list survives eligibility exclusions. */
const BUDDY_SUGGESTION_POOL_FACTOR = 4;

@Injectable()
export class BuddyViewService {
  constructor(
    private readonly buddy: BuddyService,
    private readonly sessions: SessionService,
    private readonly streak: StreakService,
    private readonly users: UsersRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  /**
   * Buddy suggestions for the /study-session empty state: people the viewer has actually shared
   * a study room with, most-shared first. Composed here because the ranking signal lives in
   * coaching (`study_sessions.room_id`) while eligibility lives in identity — community is the
   * only place that may read both.
   *
   * A cohort scan used to fill this list ("same exam, newest signups"); it was a cold-call list
   * and is gone. Someone with no shared sessions gets nothing, and the card points them at a
   * study room instead — the table is the on-ramp to a buddy now.
   */
  async getSuggestions(userId: string, limit: number): Promise<BuddySuggestionRef[]> {
    const coWorkers = await this.sessions.listRecentCoWorkers(
      userId,
      BUDDY_SUGGESTION_WINDOW_DAYS,
      limit * BUDDY_SUGGESTION_POOL_FACTOR,
    );
    if (coWorkers.length === 0) return [];

    const eligibleIds = new Set(
      await this.buddy.filterEligibleCandidates(
        userId,
        coWorkers.map((c) => c.userId),
      ),
    );
    const ranked = coWorkers.filter((c) => eligibleIds.has(c.userId)).slice(0, limit);
    if (ranked.length === 0) return [];

    const profiles = new Map(
      (await this.users.listPublicByIds(ranked.map((c) => c.userId))).map((p) => [p.userId, p]),
    );
    // Ranking order is preserved; a profile that vanished (banned meanwhile) simply drops out.
    return ranked.flatMap((c) => {
      const profile = profiles.get(c.userId);
      if (!profile) return [];
      return [
        {
          userId: c.userId,
          displayName: profile.displayName,
          username: profile.username,
          avatarUrl: profile.avatarStorageKey
            ? this.storage.getPublicUrl(profile.avatarStorageKey)
            : null,
          sessionsTogether: c.sessionsTogether,
          lastTogetherAt: c.lastTogetherAt.toISOString(),
        },
      ];
    });
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

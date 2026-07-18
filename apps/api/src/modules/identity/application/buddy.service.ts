import { HttpStatus, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { BuddyStatus } from "@mentor/types";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { IdentityEventTopic, type BuddyEvent } from "../domain/identity.events";
import {
  BuddyRepository,
  type BuddyPairRow,
  type BuddyPairWithUserRow,
} from "../infrastructure/buddy.repository";
import {
  UsersRepository,
  type CohortPeer,
  type UserRow,
} from "../infrastructure/users.repository";

/** Nudge cooldown per direction — allows a morning + evening nudge, kills spam. */
export const BUDDY_NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/** Over-fetch factor so the cohort pool survives buddy-relation exclusions. */
const SUGGESTION_POOL_FACTOR = 4;

/**
 * Study-buddy pairing (identity owns it — a user↔user relation like follows; community
 * composes the partner view, cycle-free). Mutual consent: request → accept; one ACTIVE
 * buddy per user; decline/cancel/end deletes the row. Events carry actor display fields
 * so the notifications listener needs no identity lookup (follow pattern).
 */
@Injectable()
export class BuddyService {
  constructor(
    private readonly pairs: BuddyRepository,
    private readonly usersRepo: UsersRepository,
    private readonly events: EventEmitter2,
  ) {}

  /** Send a buddy request by username. Self → 400; unknown/banned → 404; state conflicts → 409. */
  async request(userId: string, username: string): Promise<void> {
    const target = await this.requireVisibleUser(username);
    if (target.id === userId) {
      throw new DomainError(ErrorCode.SOCIAL_BUDDY_SELF, HttpStatus.BAD_REQUEST);
    }
    if (await this.pairs.findActiveByUser(userId)) {
      throw new DomainError(ErrorCode.SOCIAL_BUDDY_ALREADY_ACTIVE, HttpStatus.CONFLICT);
    }
    if (await this.pairs.findOutgoingPending(userId)) {
      throw new DomainError(ErrorCode.SOCIAL_BUDDY_REQUEST_EXISTS, HttpStatus.CONFLICT);
    }
    const existing = await this.pairs.findBetween(userId, target.id);
    if (existing) {
      // Any row between the two (pending either way, or active) blocks a new request.
      throw new DomainError(
        existing.status === "ACTIVE"
          ? ErrorCode.SOCIAL_BUDDY_ALREADY_ACTIVE
          : ErrorCode.SOCIAL_BUDDY_REQUEST_EXISTS,
        HttpStatus.CONFLICT,
      );
    }
    await this.pairs.insertPending(userId, target.id);
    await this.emitBuddyEvent(IdentityEventTopic.BUDDY_REQUESTED, userId, target.id);
  }

  /** Accept an incoming request. 404 unknown/not addressee; 409 if either party got paired meanwhile. */
  async accept(userId: string, pairId: string): Promise<void> {
    const pair = await this.pairs.findPendingById(pairId, userId);
    if (!pair || pair.addresseeId !== userId) throw new NotFoundError();
    const ok = await this.pairs.acceptInTx(pair.id, pair.requesterId, pair.addresseeId);
    if (!ok) {
      throw new DomainError(ErrorCode.SOCIAL_BUDDY_ALREADY_ACTIVE, HttpStatus.CONFLICT);
    }
    await this.emitBuddyEvent(IdentityEventTopic.BUDDY_ACCEPTED, userId, pair.requesterId);
  }

  /** Decline (as addressee) or cancel (as requester) a pending request. Silent no-op if gone. */
  async deleteRequest(userId: string, pairId: string): Promise<void> {
    await this.pairs.deleteRequest(pairId, userId);
  }

  /** End the active pairing. Silent (like unfollow). */
  async end(userId: string): Promise<void> {
    await this.pairs.deleteActive(userId);
  }

  /** Nudge the active partner. 404 when no active pairing; 429 inside the cooldown. */
  async nudge(userId: string): Promise<void> {
    const pair = await this.pokeBuddy(userId);
    await this.emitBuddyEvent(IdentityEventTopic.BUDDY_NUDGED, userId, pair.otherUserId);
  }

  /**
   * Invite the active partner to study together now. Same 404/429 semantics as nudge;
   * shares the poke cooldown (one nudge-or-invite per window — anti-spam, no extra state).
   */
  async sendStudyInvite(userId: string): Promise<void> {
    const pair = await this.pokeBuddy(userId);
    await this.emitBuddyEvent(IdentityEventTopic.BUDDY_STUDY_INVITE, userId, pair.otherUserId);
  }

  /** Shared poke: resolve active pair, enforce the per-direction cooldown, record it. */
  private async pokeBuddy(userId: string): Promise<BuddyPairWithUserRow> {
    const pair = await this.pairs.findActiveByUser(userId);
    if (!pair) throw new NotFoundError();
    const side = pair.requesterId === userId ? "requester" : "addressee";
    const lastPokeAt =
      side === "requester" ? pair.requesterLastNudgeAt : pair.addresseeLastNudgeAt;
    if (lastPokeAt && Date.now() - lastPokeAt.getTime() < BUDDY_NUDGE_COOLDOWN_MS) {
      throw new DomainError(ErrorCode.SOCIAL_BUDDY_NUDGE_COOLDOWN, HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.pairs.recordNudge(pair.id, side, new Date());
    return pair;
  }

  /**
   * Same-exam-cohort candidates for the "yol arkadaşı bul" surface, excluding the
   * viewer, anyone already related to them, and anyone who already has an active
   * buddy (can't pair). Empty when the viewer already has an active buddy.
   */
  async getSuggestionCandidates(viewerId: string, limit: number): Promise<CohortPeer[]> {
    if (await this.pairs.findActiveByUser(viewerId)) return [];
    const viewer = await this.usersRepo.findByIdService(viewerId);
    const pool = await this.usersRepo.suggestCohortPeers(
      viewer?.examType ?? null,
      [viewerId],
      limit * SUGGESTION_POOL_FACTOR,
    );
    if (pool.length === 0) return [];
    const excluded = new Set(
      await this.pairs.listRelatedOrActivelyPairedIds(
        viewerId,
        pool.map((p) => p.userId),
      ),
    );
    return pool.filter((p) => !excluded.has(p.userId)).slice(0, limit);
  }

  // --- reads consumed by community (buddy view + public profile) ---

  getActivePair(userId: string): Promise<BuddyPairWithUserRow | undefined> {
    return this.pairs.findActiveByUser(userId);
  }

  getOutgoingPending(userId: string): Promise<BuddyPairWithUserRow | undefined> {
    return this.pairs.findOutgoingPending(userId);
  }

  listIncomingPending(userId: string): Promise<BuddyPairWithUserRow[]> {
    return this.pairs.listIncomingPending(userId);
  }

  /** Viewer↔target relation for the profile button (viewer-elsewhere-active → "unavailable"). */
  async getStatusBetween(viewerId: string, targetId: string): Promise<BuddyStatus> {
    const between = await this.pairs.findBetween(viewerId, targetId);
    if (between) {
      if (between.status === "ACTIVE") return "active";
      return between.requesterId === viewerId ? "pending_outgoing" : "pending_incoming";
    }
    const viewerActive = await this.pairs.findActiveByUser(viewerId);
    return viewerActive ? "unavailable" : "none";
  }

  private async emitBuddyEvent(
    topic: string,
    actorId: string,
    recipientId: string,
  ): Promise<void> {
    // Name the actor without a listener-side lookup (best-effort — missing actor skips the event).
    const actor = await this.usersRepo.findByIdService(actorId);
    if (!actor) return;
    const payload: BuddyEvent = {
      recipientId,
      actorId,
      actorDisplayName: actor.displayName,
      actorUsername: actor.username,
    };
    this.events.emit(topic, payload);
  }

  /** Resolve a username → a visible user, or 404 (mirrors FollowService.requireVisibleUser). */
  private async requireVisibleUser(username: string): Promise<UserRow> {
    const user = await this.usersRepo.findByUsernameService(username);
    if (!user || !user.username || user.status === "BANNED" || user.status === "SUSPENDED") {
      throw new NotFoundError();
    }
    return user;
  }
}

export type { BuddyPairRow, BuddyPairWithUserRow };

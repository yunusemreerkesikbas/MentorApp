import { randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AdPlacementId,
  ExamType,
  type AdEligibilityReason,
  type AdPlacementView,
  type AdRewardCompletionView,
  type AdRewardOfferView,
  type AdRewardSessionView,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { Env } from "../../../config/env.validation";
import { ContentService } from "../../content/application/content.service";
import { EconomyService } from "../../economy/application/economy.service";
import { UsersService } from "../../identity/application/users.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { evaluateAdPolicy, istanbulDayStart } from "../domain/ad-policy";
import { AD_PLACEMENTS, ADS_REWARD_REASON, ADS_REWARD_SOURCE } from "../domain/ads.constants";
import { AdRewardSessionRepository, type AdRewardSessionRow } from "../infrastructure/ad-reward-session.repository";

@Injectable()
export class AdsService {
  constructor(
    private readonly repo: AdRewardSessionRepository,
    private readonly config: ConfigRegistryService,
    private readonly env: ConfigService<Env, true>,
    private readonly entitlements: EntitlementService,
    private readonly users: UsersService,
    private readonly economy: EconomyService,
    private readonly content: ContentService,
  ) {}

  private adUnitPath(placementId: AdPlacementId): string | null {
    const key = AD_PLACEMENTS[placementId].envKey as keyof Env;
    const value = this.env.get(key, { infer: true });
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private async placement(
    placementId: AdPlacementId,
    context: {
      userId: string | null;
      roles?: string[];
      examType: ExamType | null;
      contentExamType?: ExamType | null;
      contextVerified?: boolean;
      countryCode: string | null;
    },
  ): Promise<AdPlacementView> {
    const placement = AD_PLACEMENTS[placementId];
    const [globalEnabled, formatEnabled, placementEnabled, rolloutPercent, entitlement] = await Promise.all([
      this.config.get("ads.enabled"),
      this.config.get(placement.format === "DISPLAY" ? "ads.display.enabled" : "ads.rewarded.enabled"),
      this.config.get(placement.configKey as "ads.placement.knowledge_article_end.enabled"),
      this.config.get("ads.rewarded.web.rollout_percent"),
      context.userId
        ? this.entitlements.getEntitlement(context.userId, context.roles)
        : Promise.resolve({ isPremium: false }),
    ]);
    const decision = evaluateAdPolicy({
      globalEnabled,
      formatEnabled,
      placementEnabled,
      format: placement.format,
      countryCode: context.countryCode,
      examType: context.examType,
      contentExamType: context.contentExamType,
      isPremium: entitlement.isPremium,
      userId: context.userId,
      rolloutPercent,
    });
    const adUnitPath = this.adUnitPath(placementId);
    const contextUnverified = placement.format === "DISPLAY" && context.contextVerified === false;
    const reason: AdEligibilityReason = contextUnverified
      ? "CONTEXT_UNVERIFIED"
      : !decision.enabled
      ? decision.reason!
      : adUnitPath
        ? "ELIGIBLE"
        : "PROVIDER_NOT_CONFIGURED";
    return {
      id: placement.id,
      format: placement.format,
      enabled: !contextUnverified && decision.enabled && Boolean(adUnitPath),
      reason,
      provider: "GOOGLE_AD_MANAGER",
      adUnitPath: contextUnverified ? null : adUnitPath,
      audienceTreatment: decision.audienceTreatment,
      limitedAds: true,
      sizes: placement.sizes,
    };
  }

  async getPublicPlacement(
    placementId: AdPlacementId,
    contentSlug: string | null,
    _legacyExamType: ExamType | null,
    countryCode: string | null,
  ) {
    if (placementId !== AdPlacementId.KNOWLEDGE_ARTICLE_END) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const contentContext = await this.resolveContentContext(placementId, contentSlug);
    return this.placement(placementId, {
      userId: null,
      examType: null,
      contentExamType: contentContext.examType,
      contextVerified: contentContext.verified,
      countryCode,
    });
  }

  async getPlacement(
    placementId: AdPlacementId,
    userId: string,
    roles: string[],
    contentSlug: string | null,
    countryCode: string | null,
  ) {
    const [profile, contentContext] = await Promise.all([
      this.users.getDiscoveryProfile(userId),
      this.resolveContentContext(placementId, contentSlug),
    ]);
    return this.placement(placementId, {
      userId,
      roles,
      examType: profile.examType as ExamType | null,
      contentExamType: contentContext.examType,
      contextVerified: contentContext.verified,
      countryCode,
    });
  }

  private async resolveContentContext(
    placementId: AdPlacementId,
    contentSlug: string | null,
  ): Promise<{ verified: boolean; examType: ExamType | null }> {
    if (AD_PLACEMENTS[placementId].format !== "DISPLAY") {
      return { verified: true, examType: null };
    }
    if (!contentSlug) return { verified: false, examType: null };
    try {
      const article = await this.content.getInfoArticleBySlug(contentSlug);
      return { verified: true, examType: article.family as ExamType };
    } catch (error) {
      if (
        error instanceof DomainError &&
        (error.code === ErrorCode.CONTENT_ARTICLE_NOT_FOUND ||
          error.code === ErrorCode.VALIDATION_ERROR)
      ) {
        return { verified: false, examType: null };
      }
      throw error;
    }
  }

  async getRewardOffer(
    placementId: AdPlacementId,
    userId: string,
    roles: string[],
    countryCode: string | null,
  ): Promise<AdRewardOfferView> {
    if (placementId !== AdPlacementId.DASHBOARD_REWARDED_COIN) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const base = await this.getPlacement(placementId, userId, roles, null, countryCode);
    await this.expireAbandonedSessions(userId);
    const [rewardCoin, dailyLimit, cooldownSeconds] = await Promise.all([
      this.config.get("ads.rewarded.web.reward_coin"),
      this.config.get("ads.rewarded.web.daily_limit"),
      this.config.get("ads.rewarded.web.cooldown_seconds"),
    ]);
    const now = new Date();
    const [rewardedToday, latest, active] = await Promise.all([
      this.repo.rewardedCountSince(userId, placementId, istanbulDayStart(now)),
      this.repo.latestRewarded(userId, placementId),
      this.repo.findActive(userId, placementId, now),
    ]);
    const cooldownEndsAt = latest?.rewardedAt
      ? new Date(latest.rewardedAt.getTime() + cooldownSeconds * 1000)
      : null;
    let reason = base.reason;
    if (base.enabled && rewardedToday >= dailyLimit) reason = "DAILY_LIMIT_REACHED";
    else if (base.enabled && cooldownEndsAt && cooldownEndsAt > now) reason = "COOLDOWN_ACTIVE";
    else if (base.enabled && active) reason = "ACTIVE_SESSION_EXISTS";
    const eligible = base.enabled && reason === "ELIGIBLE";
    return {
      ...base,
      enabled: eligible,
      reason,
      eligible,
      rewardCoin,
      dailyRemaining: Math.max(0, dailyLimit - rewardedToday),
      cooldownEndsAt: cooldownEndsAt?.toISOString() ?? null,
    };
  }

  private async expireAbandonedSessions(userId: string): Promise<void> {
    const now = new Date();
    await this.repo.withServiceTx(async (tx) => {
      await this.repo.acquireUserLock(userId, tx);
      const expired = await this.repo.listExpiredCreated(userId, now, tx);
      for (const session of expired) {
        await this.economy.releaseCoinGrantInServiceTx(
          userId,
          { source: ADS_REWARD_SOURCE, refId: session.id },
          tx,
        );
        await this.repo.setStatus(session.id, "CREATED", "EXPIRED", tx, "SESSION_EXPIRED");
      }
    });
  }

  async createRewardSession(
    placementId: AdPlacementId,
    user: { id: string; roles: string[]; orgId: string | null },
    countryCode: string | null,
    idempotencyKey?: string,
  ): Promise<AdRewardSessionView> {
    const requestKey = idempotencyKey ?? randomUUID();
    const existing = await this.repo.findByIdempotencyKey(user.id, requestKey);
    if (existing) return this.toSession(existing);
    const offer = await this.getRewardOffer(placementId, user.id, user.roles, countryCode);
    if (!offer.eligible) {
      throw new DomainError(ErrorCode.ADS_NOT_ELIGIBLE, HttpStatus.UNPROCESSABLE_ENTITY, { reason: offer.reason });
    }
    const ttlSeconds = await this.config.get("ads.rewarded.web.session_ttl_seconds");
    const [dailyLimit, cooldownSeconds] = await Promise.all([
      this.config.get("ads.rewarded.web.daily_limit"),
      this.config.get("ads.rewarded.web.cooldown_seconds"),
    ]);
    const now = new Date();
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const row = await this.repo.withServiceTx(async (tx) => {
      await this.repo.acquireUserLock(user.id, tx);
      const replay = await this.repo.findByIdempotencyKey(user.id, requestKey, tx);
      if (replay) return replay;
      // A node-postgres transaction owns one client; queries on that client must stay sequential.
      const rewardedToday = await this.repo.rewardedCountSince(
        user.id,
        placementId,
        istanbulDayStart(now),
        tx,
      );
      const latest = await this.repo.latestRewarded(user.id, placementId, tx);
      if (rewardedToday >= dailyLimit) {
        throw new DomainError(ErrorCode.ADS_NOT_ELIGIBLE, HttpStatus.CONFLICT, { reason: "DAILY_LIMIT_REACHED" });
      }
      if (latest?.rewardedAt && latest.rewardedAt.getTime() + cooldownSeconds * 1000 > now.getTime()) {
        throw new DomainError(ErrorCode.ADS_NOT_ELIGIBLE, HttpStatus.CONFLICT, { reason: "COOLDOWN_ACTIVE" });
      }
      if (await this.repo.findActive(user.id, placementId, now, tx)) {
        throw new DomainError(ErrorCode.ADS_NOT_ELIGIBLE, HttpStatus.CONFLICT, { reason: "ACTIVE_SESSION_EXISTS" });
      }
      await this.economy.reserveCoinGrantInServiceTx(
        user.id,
        offer.rewardCoin,
        { source: ADS_REWARD_SOURCE, refId: id, expiresAt, orgId: user.orgId },
        tx,
      );
      return this.repo.create({
        id,
        orgId: user.orgId,
        userId: user.id,
        placementId,
        rewardCoin: offer.rewardCoin,
        idempotencyKey: requestKey,
        expiresAt,
      }, tx);
    });
    return this.toSession(row);
  }

  async completeRewardSession(id: string, userId: string): Promise<AdRewardCompletionView> {
    const row = await this.repo.withServiceTx(async (tx) => {
      await this.repo.acquireUserLock(userId, tx);
      const session = await this.repo.findOwned(id, userId, tx);
      if (!session) throw new DomainError(ErrorCode.ADS_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
      if (session.status === "REWARDED") return session;
      if (session.status !== "CREATED") {
        throw new DomainError(ErrorCode.ADS_NOT_ELIGIBLE, HttpStatus.CONFLICT);
      }
      if (session.expiresAt <= new Date()) {
        await this.economy.releaseCoinGrantInServiceTx(userId, { source: ADS_REWARD_SOURCE, refId: id }, tx);
        await this.repo.setStatus(id, "CREATED", "EXPIRED", tx, "SESSION_EXPIRED");
        throw new DomainError(ErrorCode.ADS_SESSION_EXPIRED, HttpStatus.GONE);
      }
      await this.economy.settleCoinGrantInServiceTx(userId, {
        source: ADS_REWARD_SOURCE,
        refId: id,
        reason: ADS_REWARD_REASON,
        ledgerRefType: ADS_REWARD_SOURCE,
        ledgerRefId: id,
      }, tx);
      await this.repo.setStatus(id, "CREATED", "REWARDED", tx);
      return { ...session, status: "REWARDED" as const, rewardedAt: new Date() };
    });
    const balance = await this.economy.getAdminBalance(userId);
    return { ...this.toSession(row), balance: balance.coinConfirmed };
  }

  async closeRewardSession(id: string, userId: string): Promise<AdRewardSessionView> {
    const row = await this.repo.withServiceTx(async (tx) => {
      await this.repo.acquireUserLock(userId, tx);
      const session = await this.repo.findOwned(id, userId, tx);
      if (!session) throw new DomainError(ErrorCode.ADS_SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
      if (session.status !== "CREATED") return session;
      await this.economy.releaseCoinGrantInServiceTx(userId, { source: ADS_REWARD_SOURCE, refId: id }, tx);
      await this.repo.setStatus(id, "CREATED", "CLOSED", tx);
      return { ...session, status: "CLOSED" as const };
    });
    return this.toSession(row);
  }

  async expireDueSessions(limit = 200): Promise<{ expired: number }> {
    const boundedLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const now = new Date();
    const candidates = await this.repo.listExpiredCandidates(now, boundedLimit);
    const userIds = [...new Set(candidates.map((candidate) => candidate.userId))];
    let expired = 0;

    for (const userId of userIds) {
      if (expired >= boundedLimit) break;
      expired += await this.repo.withServiceTx(async (tx) => {
        await this.repo.acquireUserLock(userId, tx);
        const sessions = await this.repo.lockExpiredForUser(
          userId,
          now,
          boundedLimit - expired,
          tx,
        );
        let count = 0;
        for (const session of sessions) {
          await this.economy.releaseCoinGrantInServiceTx(
            userId,
            { source: ADS_REWARD_SOURCE, refId: session.id },
            tx,
          );
          if (
            await this.repo.setStatus(
              session.id,
              "CREATED",
              "EXPIRED",
              tx,
              "SESSION_EXPIRED",
            )
          ) {
            count += 1;
          }
        }
        return count;
      });
    }
    return { expired };
  }

  private toSession(row: AdRewardSessionRow): AdRewardSessionView {
    return { id: row.id, status: row.status as AdRewardSessionView["status"], rewardCoin: row.rewardCoin, expiresAt: row.expiresAt.toISOString() };
  }
}

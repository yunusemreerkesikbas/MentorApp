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
import { EconomyService } from "../../economy/application/economy.service";
import { UsersService } from "../../identity/application/users.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { evaluateAdPolicy } from "../domain/ad-policy";
import { AD_PLACEMENTS, ADS_REWARD_REASON, ADS_REWARD_SOURCE } from "../domain/ads.constants";
import { AdRewardSessionRepository, type AdRewardSessionRow } from "../infrastructure/ad-reward-session.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdsService {
  constructor(
    private readonly repo: AdRewardSessionRepository,
    private readonly config: ConfigRegistryService,
    private readonly env: ConfigService<Env, true>,
    private readonly entitlements: EntitlementService,
    private readonly users: UsersService,
    private readonly economy: EconomyService,
  ) {}

  private adUnitPath(placementId: AdPlacementId): string | null {
    const key = AD_PLACEMENTS[placementId].envKey as keyof Env;
    const value = this.env.get(key, { infer: true });
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private async placement(
    placementId: AdPlacementId,
    context: { userId: string | null; roles?: string[]; examType: ExamType | null; countryCode: string | null },
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
      isPremium: entitlement.isPremium,
      userId: context.userId,
      rolloutPercent,
    });
    const adUnitPath = this.adUnitPath(placementId);
    const reason: AdEligibilityReason = !decision.enabled
      ? decision.reason!
      : adUnitPath
        ? "ELIGIBLE"
        : "PROVIDER_NOT_CONFIGURED";
    return {
      id: placement.id,
      format: placement.format,
      enabled: decision.enabled && Boolean(adUnitPath),
      reason,
      provider: "GOOGLE_AD_MANAGER",
      adUnitPath,
      audienceTreatment: decision.audienceTreatment,
      limitedAds: true,
      sizes: placement.sizes,
    };
  }

  getPublicPlacement(placementId: AdPlacementId, examType: ExamType | null, countryCode: string | null) {
    if (placementId !== AdPlacementId.KNOWLEDGE_ARTICLE_END) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return this.placement(placementId, { userId: null, examType, countryCode });
  }

  async getPlacement(
    placementId: AdPlacementId,
    userId: string,
    roles: string[],
    countryCode: string | null,
  ) {
    const profile = await this.users.getDiscoveryProfile(userId);
    return this.placement(placementId, {
      userId,
      roles,
      examType: profile.examType as ExamType | null,
      countryCode,
    });
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
    const base = await this.getPlacement(placementId, userId, roles, countryCode);
    await this.expireAbandonedSessions(userId);
    const [rewardCoin, dailyLimit, cooldownSeconds] = await Promise.all([
      this.config.get("ads.rewarded.web.reward_coin"),
      this.config.get("ads.rewarded.web.daily_limit"),
      this.config.get("ads.rewarded.web.cooldown_seconds"),
    ]);
    const now = new Date();
    const [rewardedToday, latest, active] = await Promise.all([
      this.repo.rewardedCountSince(userId, placementId, new Date(now.getTime() - DAY_MS)),
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
  ): Promise<AdRewardSessionView> {
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
      const [rewardedToday, latest] = await Promise.all([
        this.repo.rewardedCountSince(user.id, placementId, new Date(now.getTime() - DAY_MS), tx),
        this.repo.latestRewarded(user.id, placementId, tx),
      ]);
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

  private toSession(row: AdRewardSessionRow): AdRewardSessionView {
    return { id: row.id, status: row.status as AdRewardSessionView["status"], rewardCoin: row.rewardCoin, expiresAt: row.expiresAt.toISOString() };
  }
}

import { HttpStatus, Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import type { SavedPlanPreviewDto } from "@mentor/types";
import type { CoinPlanPreviewInput } from "@mentor/validation";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { EconomyService } from "../../economy/application/economy.service";
import { EconomyLedger } from "../../economy/domain/economy.constants";
import {
  PLAN_PREVIEW_WINDOW_MS,
  planPreviewHash,
} from "../domain/plan-coin-preview";
import { promptLocale } from "../domain/prompt-locale";
import {
  PlanPreviewRepository,
  type PlanPreviewRow,
} from "../infrastructure/plan-preview.repository";
import { PlanAdaptationService } from "./plan-adaptation.service";
import { PlanPreviewAccessService } from "./plan-preview-access.service";

/** Model calls are outside transactions. A valid saved result precedes the atomic Coin settlement. */
@Injectable()
export class CoinPlanPreviewService {
  constructor(
    private readonly previews: PlanPreviewRepository,
    private readonly access: PlanPreviewAccessService,
    private readonly adaptation: PlanAdaptationService,
    private readonly economy: EconomyService,
    private readonly config: ConfigRegistryService,
  ) {}

  async generate(
    user: RequestUser,
    body: CoinPlanPreviewInput,
  ): Promise<SavedPlanPreviewDto> {
    const locale = promptLocale(I18nContext.current()?.lang);
    const hash = planPreviewHash(body.input, locale);
    const old = await this.previews.withUserLock(user.id, (tx) =>
      this.previews.find(user.id, body.clientRequestId, tx),
    );
    if (old) {
      if (old.inputHash !== hash)
        throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
      return old.status === "GENERATED"
        ? this.confirm(user, body.clientRequestId, old.cost)
        : this.existing(old);
    }
    await this.assertCoinEnabled();
    const offer = await this.access.get(user);
    if (offer.mode !== "COIN")
      throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
    if (!offer.canGenerate) this.deny(offer.reason);
    if (offer.cost !== body.expectedCost)
      throw new DomainError(
        ErrorCode.AI_PLAN_PRICE_CHANGED,
        HttpStatus.CONFLICT,
      );
    const claim = await this.previews.withUserLock(user.id, async (tx) => {
      const existing = await this.previews.find(
        user.id,
        body.clientRequestId,
        tx,
      );
      if (existing) return existing;
      const used = await this.previews.countSince(
        user.id,
        new Date(Date.now() - PLAN_PREVIEW_WINDOW_MS),
        tx,
      );
      if (used >= offer.dailyLimit)
        throw new DomainError(
          ErrorCode.AI_PLAN_COIN_LIMIT_REACHED,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      await this.previews.create(
        {
          userId: user.id,
          orgId: user.orgId,
          clientRequestId: body.clientRequestId,
          inputHash: hash,
          locale,
          cost: body.expectedCost,
          status: "RUNNING",
        },
        tx,
      );
      return null;
    });
    if (claim) {
      if (claim.inputHash !== hash)
        throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
      return claim.status === "GENERATED"
        ? this.confirm(user, body.clientRequestId, claim.cost)
        : this.existing(claim);
    }
    try {
      const response = await this.adaptation.preview(
        user,
        body.input,
        body.clientRequestId,
      );
      await this.previews.withUserLock(user.id, async (tx) => {
        const row = await this.previews.find(user.id, body.clientRequestId, tx);
        if (row?.status !== "RUNNING")
          throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
        await this.previews.set(
          user.id,
          body.clientRequestId,
          {
            status: response.status === "NO_CHANGE" ? "READY" : "GENERATED",
            response,
            ...(response.status === "NO_CHANGE" ? { cost: 0 } : {}),
          },
          tx,
        );
      });
    } catch (error) {
      await this.previews.withUserLock(user.id, async (tx) => {
        const row = await this.previews.find(user.id, body.clientRequestId, tx);
        if (row?.status === "RUNNING")
          await this.previews.set(
            user.id,
            body.clientRequestId,
            { status: "FAILED" },
            tx,
          );
      });
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.confirm(user, body.clientRequestId, body.expectedCost);
  }

  async confirm(
    user: RequestUser,
    requestId: string,
    expectedCost: number,
  ): Promise<SavedPlanPreviewDto> {
    const old = await this.previews.find(user.id, requestId);
    if (!old) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (old.status === "READY") return this.view(old);
    await this.assertCoinEnabled();
    if (old.cost !== expectedCost)
      throw new DomainError(
        ErrorCode.AI_PLAN_PRICE_CHANGED,
        HttpStatus.CONFLICT,
      );
    // No budget check here: the model has already finished. Settling a stored result calls no AI.
    return this.previews.withUserLock(user.id, async (tx) => {
      const row = await this.previews.find(user.id, requestId, tx);
      if (!row)
        throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      if (row.status === "READY") return this.view(row);
      if (row.status !== "GENERATED" || !row.response)
        return this.existing(row);
      await this.economy.spendInServiceTx(
        user.id,
        row.cost,
        {
          reason: EconomyLedger.PLAN_PREVIEW_SPEND_REASON,
          refType: EconomyLedger.PLAN_PREVIEW_REF_TYPE,
          refId: `${user.id}:${requestId}`,
        },
        tx,
      );
      await this.previews.set(user.id, requestId, { status: "READY" }, tx);
      return this.view({ ...row, status: "READY" });
    });
  }

  async read(userId: string, requestId: string): Promise<SavedPlanPreviewDto> {
    const row = await this.previews.find(userId, requestId);
    if (!row) throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    // An unpaid result cannot advertise a new Coin confirmation while purchases are closed.
    if (row.status === "GENERATED") await this.assertCoinEnabled();
    return this.view(row);
  }

  async assertCoinEnabled(): Promise<void> {
    if (!(await this.config.get("ai.enabled")))
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    if (
      !(await this.config.get("economy.enabled")) ||
      !(await this.config.get("ai.plan.coin_enabled"))
    ) {
      throw new DomainError(ErrorCode.ECONOMY_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  private existing(row: PlanPreviewRow): SavedPlanPreviewDto {
    if (row.status === "RUNNING")
      throw new DomainError(
        ErrorCode.AI_PLAN_REQUEST_PROCESSING,
        HttpStatus.CONFLICT,
      );
    if (row.status === "FAILED")
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    return this.view(row);
  }

  private view(row: PlanPreviewRow): SavedPlanPreviewDto {
    return {
      requestId: row.clientRequestId,
      state: row.status,
      cost: row.cost,
      preview: row.status === "READY" ? row.response : null,
      coinSpent: row.status === "READY" ? row.cost : 0,
    };
  }

  private deny(reason?: string): never {
    const code = reason as ErrorCode | undefined;
    const status =
      code === ErrorCode.AI_PLAN_COIN_LIMIT_REACHED
        ? HttpStatus.TOO_MANY_REQUESTS
        : code === ErrorCode.AI_BUDGET_EXCEEDED
          ? HttpStatus.SERVICE_UNAVAILABLE
          : code === ErrorCode.AI_DISABLED
            ? HttpStatus.NOT_FOUND
            : HttpStatus.UNPROCESSABLE_ENTITY;
    throw new DomainError(code ?? ErrorCode.PAYMENT_PREMIUM_REQUIRED, status);
  }
}

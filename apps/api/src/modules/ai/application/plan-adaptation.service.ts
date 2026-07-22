import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type {
  CoachPlanAdaptationDto,
  CoachPlanAdaptationStatus,
} from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { MoodService } from "../../coaching/application/mood.service";
import { PlanService } from "../../coaching/application/plan.service";
import { SessionService } from "../../coaching/application/session.service";
import { EntitlementService } from "../../payments/application/entitlement.service";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import {
  buildPlanAdaptationPrompt,
  parsePlanAdaptation,
  PLAN_ADAPTATION_MAX_PROMPT_TASKS,
  type PromptPlanTask,
} from "../domain/plan-adaptation";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { ContextBuilder } from "./context-builder.service";
import { promptLocale } from "../domain/prompt-locale";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Premium, user-triggered preview. This service never mutates coaching plan data. */
@Injectable()
export class PlanAdaptationService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly plans: PlanService,
    private readonly moods: MoodService,
    private readonly sessions: SessionService,
    private readonly context: ContextBuilder,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly entitlement: EntitlementService,
    private readonly budget: AiBudgetGuard,
    private readonly i18n: I18nService,
  ) {}

  async preview(
    user: RequestUser,
    input: CoachPlanAdaptationInput,
  ): Promise<CoachPlanAdaptationDto> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    const entitlement = await this.entitlement.getEntitlement(
      user.id,
      user.roles,
    );
    if (!entitlement.isPremium) {
      throw new DomainError(
        ErrorCode.PAYMENT_PREMIUM_REQUIRED,
        HttpStatus.FORBIDDEN,
      );
    }

    const snapshot = await this.plans.getAdaptationSnapshot(user.id);
    await this.assertSourceApplicable(user.id, input);

    const pendingTasks = snapshot.tasks
      .filter((task) => task.status === "PENDING")
      .sort(
        (a, b) =>
          a.taskDate.localeCompare(b.taskDate) ||
          a.sortOrder - b.sortOrder ||
          a.id.localeCompare(b.id),
      );
    if (
      input.source === "MOOD" &&
      !pendingTasks.some((task) => task.taskDate === snapshot.window.from)
    ) {
      return this.response("NO_CHANGE", snapshot, [], "rules");
    }

    const [dailyLimit, usedToday, context] = await Promise.all([
      this.config.get("ai.plan_draft.daily_limit"),
      this.usage.countFeaturesSince(
        user.id,
        [AiUsageFeature.PLAN_DRAFT, AiUsageFeature.PLAN_ADAPTATION],
        new Date(Date.now() - DAY_MS),
      ),
      this.context.build(user.id),
    ]);
    if (usedToday >= dailyLimit) {
      throw new DomainError(
        ErrorCode.AI_RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const referencedTasks: PromptPlanTask[] = pendingTasks
      .slice(0, PLAN_ADAPTATION_MAX_PROMPT_TASKS)
      .map((task, index) => ({
        ...task,
        ref: `T${index + 1}`,
      }));
    const promptTasks =
      input.source === "MOOD"
        ? referencedTasks.filter(
            (task) => task.taskDate === snapshot.window.from,
          )
        : referencedTasks;
    const { system, user: userMessage } = buildPlanAdaptationPrompt({
      source: input.source,
      todayIso: snapshot.window.from,
      examType: context.examType,
      recentSummary: context.recentSessions
        ? {
            count7d: context.recentSessions.count7d,
            focusMinutes7d: context.recentSessions.focusMinutes7d,
            subjects: context.recentSessions.subjects,
          }
        : null,
      tasks: promptTasks,
      note: input.source === "PLAN" ? input.note : undefined,
      locale: promptLocale(I18nContext.current()?.lang),
    });

    await this.budget.assertWithinBudget();
    const result = await this.llm.complete({ system, user: userMessage });
    await this.usage.append({
      userId: user.id,
      model: result.model,
      feature: AiUsageFeature.PLAN_ADAPTATION,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costMicros: estimateCostMicros(
        result.model,
        result.promptTokens,
        result.completionTokens,
      ),
    });

    const parsed = parsePlanAdaptation(
      result.text,
      snapshot.window.from,
      input.source,
      promptTasks,
      pendingTasks,
    );
    if (parsed.kind === "MALFORMED") {
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.response(
      parsed.changes.length > 0 ? "READY" : "NO_CHANGE",
      snapshot,
      parsed.changes,
      result.model,
    );
  }

  private async assertSourceApplicable(
    userId: string,
    input: CoachPlanAdaptationInput,
  ): Promise<void> {
    if (input.source === "MOOD") {
      const mood = await this.moods.getToday(userId);
      if (!mood || mood.mood > 2) {
        throw new DomainError(
          ErrorCode.AI_PLAN_ADAPTATION_NOT_APPLICABLE,
          HttpStatus.CONFLICT,
        );
      }
      return;
    }
    if (input.source === "SESSION") {
      const session = await this.sessions.getById(userId, input.sessionId);
      if (!session) {
        throw new DomainError(
          ErrorCode.COACHING_SESSION_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      if (session.status !== "COMPLETED" || session.sessionMood !== 1) {
        throw new DomainError(
          ErrorCode.AI_PLAN_ADAPTATION_NOT_APPLICABLE,
          HttpStatus.CONFLICT,
        );
      }
    }
  }

  private response(
    status: CoachPlanAdaptationStatus,
    snapshot: Awaited<ReturnType<PlanService["getAdaptationSnapshot"]>>,
    changes: CoachPlanAdaptationDto["changes"],
    model: string,
  ): CoachPlanAdaptationDto {
    return {
      status,
      message: this.i18n.translate(`coaching.planAdaptation.${status}`, {
        lang: I18nContext.current()?.lang,
      }) as unknown as string,
      window: snapshot.window,
      planRevision: snapshot.planRevision,
      changes,
      model,
    };
  }
}

import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  CoachEvidenceType,
  PremiumFeatureId,
  type CoachPlanAdaptationBriefDto,
  type CoachPlanAdaptationDto,
  type CoachPlanAdaptationStatus,
} from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { CoachEvidenceService } from "../../coaching/application/coach-evidence.service";
import { MoodService } from "../../coaching/application/mood.service";
import { PlanService } from "../../coaching/application/plan.service";
import { SessionService } from "../../coaching/application/session.service";
import { AiUsageFeature, estimateCostMicros } from "../domain/ai.constants";
import { LLM_PORT, type LlmPort } from "../domain/llm.port";
import {
  buildPlanAdaptationPrompt,
  parsePlanAdaptation,
  PLAN_ADAPTATION_MAX_PROMPT_TASKS,
  selectPlanEvidence,
  suggestPlanBrief,
  type PromptEvidence,
  type PromptPlanTask,
} from "../domain/plan-adaptation";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { CoachProfileService } from "./coach-profile.service";
import { groundingFact } from "../domain/grounding-fact";
import { promptLocale } from "../domain/prompt-locale";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";

const DAY_MS = 24 * 60 * 60 * 1000;

type AdaptationSnapshot = Awaited<ReturnType<PlanService["getAdaptationSnapshot"]>>;

/** Premium, user-triggered preview. This service never mutates coaching plan data. */
@Injectable()
export class PlanAdaptationService {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly plans: PlanService,
    private readonly moods: MoodService,
    private readonly sessions: SessionService,
    private readonly evidence: CoachEvidenceService,
    private readonly usage: AiUsageRepository,
    private readonly config: ConfigRegistryService,
    private readonly featureGate: PremiumFeatureGateService,
    private readonly budget: AiBudgetGuard,
    private readonly i18n: I18nService,
    private readonly profiles: CoachProfileService,
  ) {}

  /** Wizard seed: what the coach will read and sensible defaults. No model call, no quota. */
  async brief(user: RequestUser): Promise<CoachPlanAdaptationBriefDto> {
    await this.assertAvailable(user);
    const pool = await this.evidence.build(user.id);
    return {
      groundingLine: groundingFact({
        signal: "COVERAGE",
        locale: promptLocale(I18nContext.current()?.lang),
        coverage: pool.coverage,
      }),
      evidence: this.visible(selectPlanEvidence("PLAN", pool.evidence)),
      suggestion: suggestPlanBrief(pool),
    };
  }

  async preview(
    user: RequestUser,
    input: CoachPlanAdaptationInput,
  ): Promise<CoachPlanAdaptationDto> {
    await this.assertAvailable(user);

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
      // Nothing to lighten: no model call, but a true sentence and what it read, never a blank sheet.
      const pool = await this.evidence.build(user.id);
      return this.response(
        "NO_CHANGE",
        snapshot,
        [],
        "rules",
        groundingFact({
          signal: "REST",
          locale: promptLocale(I18nContext.current()?.lang),
          todayPlan: this.todayPlan(snapshot),
        }),
        selectPlanEvidence("MOOD", pool.evidence),
        // Same status for the API; the words match a day that is already done.
        "REST",
      );
    }

    const [dailyLimit, usedToday, pool] = await Promise.all([
      this.config.get("ai.plan_draft.daily_limit"),
      this.usage.countFeaturesSince(
        user.id,
        [AiUsageFeature.PLAN_DRAFT, AiUsageFeature.PLAN_ADAPTATION],
        new Date(Date.now() - DAY_MS),
      ),
      this.evidence.build(user.id),
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
    const locale = promptLocale(I18nContext.current()?.lang);
    const selected = selectPlanEvidence(input.source, pool.evidence);
    // Preferences and memory shape a whole week; a low-mood or hard-session fix stays narrow.
    const personal =
      input.source === "PLAN" ? await this.personalContext(user.id) : {};
    const { system, user: userMessage } = buildPlanAdaptationPrompt({
      source: input.source,
      todayIso: snapshot.window.from,
      examType: pool.examType,
      evidence: selected,
      examPhase: input.source === "PLAN" ? pool.examPhase : null,
      ...personal,
      tasks: promptTasks,
      note: input.source === "PLAN" ? input.note : undefined,
      days: input.source === "PLAN" ? input.days : undefined,
      minutesPerDay: input.source === "PLAN" ? input.minutesPerDay : undefined,
      focusSubjects: input.source === "PLAN" ? input.focusSubjects : undefined,
      locale,
      moodLevel: pool.moodLevel,
    });
    const groundingLine =
      input.source === "PLAN"
        ? groundingFact({ signal: "COVERAGE", locale, coverage: pool.coverage })
        : groundingFact({
            signal: "PLAN",
            locale,
            pendingSubjects: promptTasks.flatMap((task) =>
              task.subject ? [task.subject] : [],
            ),
            todayPlan: this.todayPlan(snapshot),
          });

    await this.budget.assertWithinBudget();
    const result = await this.llm.complete({ system, user: userMessage });
    await this.usage.append({
      ...(result.budgetReservationId ? { budgetReservationId: result.budgetReservationId } : {}),
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
      input.source === "PLAN"
        ? {
            days: input.days,
            minutesPerDay: input.minutesPerDay,
            focusSubjects: input.focusSubjects,
            locale,
          }
        : undefined,
      {
        evidence: selected,
        weakSubjects: pool.weakSubjects,
        weakReason:
          pool.evidence.find(
            (item) => item.type === CoachEvidenceType.WEAK_SUBJECTS,
          )?.summary ?? null,
        chosenReason: this.i18n.translate(
          "coaching.planAdaptation.reasonChosenSubject",
          { lang: I18nContext.current()?.lang },
        ) as unknown as string,
      },
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
      groundingLine,
      selected,
    );
  }

  private async assertAvailable(user: RequestUser): Promise<void> {
    if (!(await this.config.get(FeatureFlag.AI_ENABLED))) {
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    }
    await this.featureGate.assertAllowed(
      user.id,
      user.roles,
      PremiumFeatureId.PLAN_AI,
    );
  }

  /** Coaching preferences always; structured memory only after explicit consent. */
  private async personalContext(userId: string) {
    const profile = await this.profiles.getProfile(userId);
    const memories =
      profile.memoryConsent === "GRANTED"
        ? await this.profiles.getPromptMemories(userId)
        : [];
    return {
      memories,
      preferences: {
        support: profile.supportPreference,
        directness: profile.directnessPreference,
      },
    };
  }

  private todayPlan(
    snapshot: AdaptationSnapshot,
  ): { total: number; done: number } | null {
    const today = snapshot.tasks.filter(
      (task) => task.taskDate === snapshot.window.from,
    );
    return today.length > 0
      ? {
          total: today.length,
          done: today.filter((task) => task.status === "DONE").length,
        }
      : null;
  }

  /** The evidence refs are prompt plumbing; the student sees the lines only. */
  private visible(evidence: PromptEvidence[]) {
    return evidence.map(({ ref: _ref, ...item }) => item);
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
    snapshot: AdaptationSnapshot,
    changes: CoachPlanAdaptationDto["changes"],
    model: string,
    groundingLine: string | null,
    evidence: PromptEvidence[],
    messageKey: CoachPlanAdaptationStatus | "REST" = status,
  ): CoachPlanAdaptationDto {
    return {
      status,
      message: this.i18n.translate(`coaching.planAdaptation.${messageKey}`, {
        lang: I18nContext.current()?.lang,
      }) as unknown as string,
      groundingLine,
      window: snapshot.window,
      planRevision: snapshot.planRevision,
      changes,
      model,
      usedEvidence: this.visible(evidence),
    };
  }
}

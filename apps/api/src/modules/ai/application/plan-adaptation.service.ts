import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  CoachEvidenceType,
  PremiumFeatureId,
  type CoachPlanAdaptationBriefDto,
  type CoachPlanAdaptationDto,
} from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { RequestUser } from "../../../common/auth/current-user";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { CoachEvidenceService } from "../../coaching/application/coach-evidence.service";
import { ContentService } from "../../content/application/content.service";
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
  studyDatesFor,
  suggestPlanBrief,
  type PromptPlanTask,
} from "../domain/plan-adaptation";
import { AiUsageRepository } from "../infrastructure/ai-usage.repository";
import { AiBudgetGuard } from "./ai-budget.guard";
import { CoachProfileService } from "./coach-profile.service";
import { groundingFact } from "../domain/grounding-fact";
import { promptLocale } from "../domain/prompt-locale";
import { PremiumFeatureGateService } from "./premium-feature-gate.service";
import { PlanPreviewRepository } from "../infrastructure/plan-preview.repository";
import { planPreviewHash } from "../domain/plan-coin-preview";

import {
  coachPlanNote,
  planAdaptationResponse,
  planAdaptationToday,
  visiblePlanEvidence,
} from "./plan-adaptation-view";

import {
  planPersonalContext,
  assertPlanSourceApplicable,
} from "./plan-adaptation-context";

const DAY_MS = 24 * 60 * 60 * 1000;

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
    private readonly content: ContentService,
    private readonly coinPreviews: PlanPreviewRepository,
  ) {}

  /** Wizard seed: what the coach will read and sensible defaults. No model call, no quota. */
  async brief(
    user: RequestUser,
    coinBrief = false,
  ): Promise<CoachPlanAdaptationBriefDto> {
    if (!coinBrief) await this.assertAvailable(user);
    const pool = await this.evidence.build(user.id);
    return {
      groundingLine: groundingFact({
        signal: "COVERAGE",
        locale: promptLocale(I18nContext.current()?.lang),
        coverage: pool.coverage,
      }),
      evidence: visiblePlanEvidence(selectPlanEvidence("PLAN", pool.evidence)),
      suggestion: suggestPlanBrief(pool),
    };
  }

  async preview(
    user: RequestUser,
    input: CoachPlanAdaptationInput,
    coinRequestId?: string,
  ): Promise<CoachPlanAdaptationDto> {
    if (coinRequestId) {
      if (!(await this.config.get(FeatureFlag.AI_ENABLED)))
        throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
      const row = await this.coinPreviews.find(user.id, coinRequestId);
      const locale = promptLocale(I18nContext.current()?.lang);
      if (
        input.source !== "PLAN" ||
        row?.status !== "RUNNING" ||
        row.inputHash !== planPreviewHash(input, locale)
      ) {
        throw new DomainError(ErrorCode.CONFLICT, HttpStatus.CONFLICT);
      }
    } else await this.assertAvailable(user);

    const snapshot = await this.plans.getAdaptationSnapshot(user.id);
    await assertPlanSourceApplicable(this.moods, this.sessions, user.id, input);

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
      return planAdaptationResponse(
        this.i18n,
        "NO_CHANGE",
        snapshot,
        [],
        "rules",
        groundingFact({
          signal: "REST",
          locale: promptLocale(I18nContext.current()?.lang),
          todayPlan: planAdaptationToday(snapshot),
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
    let topics: Awaited<ReturnType<ContentService["listExamTopicsByExamId"]>> =
      [];
    if (input.source === "PLAN" && pool.examType) {
      try {
        const exam = await this.content.getCurrentExamByFamily(
          pool.examType,
          pool.examVariant,
        );
        topics = await this.content.listExamTopicsByExamId(exam.id);
      } catch (error) {
        if (
          !(error instanceof DomainError) ||
          error.code !== ErrorCode.CONTENT_EXAM_NOT_FOUND
        )
          throw error;
      }
    }
    const studyDates =
      input.source === "PLAN" && input.studyWeekdays?.length
        ? studyDatesFor(snapshot.window.from, input.studyWeekdays)
        : undefined;
    // Preferences and memory shape a whole week; a low-mood or hard-session fix stays narrow.
    const personal =
      input.source === "PLAN"
        ? await planPersonalContext(this.profiles, user.id)
        : {};
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
      studyDates,
      minutesPerDay: input.source === "PLAN" ? input.minutesPerDay : undefined,
      focusSubjects: input.source === "PLAN" ? input.focusSubjects : undefined,
      topics,
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
            todayPlan: planAdaptationToday(snapshot),
          });

    await this.budget.assertWithinBudget();
    const result = await this.llm.complete({ system, user: userMessage });
    await this.usage.append({
      ...(result.budgetReservationId
        ? { budgetReservationId: result.budgetReservationId }
        : {}),
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
            studyDates,
            minutesPerDay: input.minutesPerDay,
            focusSubjects: input.focusSubjects,
            topics,
            locale,
            strictOutput: coinRequestId !== undefined,
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
        notebookReason:
          pool.evidence.find(
            (item) => item.type === CoachEvidenceType.NOTEBOOK_TOPICS,
          )?.summary ?? null,
      },
    );
    if (parsed.kind === "MALFORMED") {
      throw new DomainError(
        ErrorCode.AI_PROVIDER_ERROR,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const coachNote =
      input.source === "PLAN" &&
      input.minutesPerDay &&
      parsed.changes.some((change) => change.kind === "ADD")
        ? coachPlanNote(this.i18n, pool, input.minutesPerDay, parsed.changes)
        : null;
    return planAdaptationResponse(
      this.i18n,
      parsed.changes.length > 0 ? "READY" : "NO_CHANGE",
      snapshot,
      parsed.changes,
      result.model,
      groundingLine,
      selected,
      undefined,
      coachNote,
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
}

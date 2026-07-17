import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { CoachingModule } from "../coaching/coaching.module";
import { ContentModule } from "../content/content.module";
import { EconomyModule } from "../economy/economy.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { LLM_PORT } from "./domain/llm.port";
import { VISION_PORT } from "./domain/vision.port";
import { ChatService } from "./application/chat.service";
import { CoachAccessService } from "./application/coach-access.service";
import { MoodReflectionService } from "./application/mood-reflection.service";
import { DailyGreetingService } from "./application/daily-greeting.service";
import { PlanDraftService } from "./application/plan-draft.service";
import { SessionReflectionService } from "./application/session-reflection.service";
import { GhostNarrationService } from "./application/ghost-narration.service";
import { VisionNoteService } from "./application/vision-note.service";
import { WeeklyReviewNarrationService } from "./application/weekly-review-narration.service";
import { PhotoAccessService } from "./application/photo-access.service";
import { PhotoCategorizeService } from "./application/photo-categorize.service";
import { PhotoUploadService } from "./application/photo-upload.service";
import { ContextBuilder } from "./application/context-builder.service";
import { EmbeddingService } from "./application/embedding.service";
import { ArticleEmbeddingListener } from "./application/article-embedding.listener";
import { AiJobRegistrar } from "./application/ai-job.registrar";
import { EmbedArticleHandler } from "./application/handlers/embed-article.handler";
import { RefreshMemoryHandler } from "./application/handlers/refresh-memory.handler";
import { AiCostStatsService } from "./application/ai-cost-stats.service";
import { AiBudgetGuard } from "./application/ai-budget.guard";
import { AiErasureService } from "./application/ai-erasure.service";
import { CoachFeedbackStatsService } from "./application/coach-feedback-stats.service";
import { AiUsageRepository } from "./infrastructure/ai-usage.repository";
import { CoachMessageRepository } from "./infrastructure/coach-message.repository";
import { CoachConversationRepository } from "./infrastructure/coach-conversation.repository";
import { CoachMemoryRepository } from "./infrastructure/coach-memory.repository";
import { WeeklyReviewCacheRepository } from "./infrastructure/weekly-review-cache.repository";
import { DailyGreetingRepository } from "./infrastructure/daily-greeting.repository";
import { FakeLlmAdapter } from "./infrastructure/adapters/fake-llm.adapter";
import { OpenAiLlmAdapter } from "./infrastructure/adapters/openai-llm.adapter";
import { GeminiLlmAdapter } from "./infrastructure/adapters/gemini-llm.adapter";
import { OpenAiVisionAdapter } from "./infrastructure/adapters/openai-vision.adapter";
import { FakeVisionAdapter } from "./infrastructure/adapters/fake-vision.adapter";
import { GeminiVisionAdapter } from "./infrastructure/adapters/gemini-vision.adapter";
import { AiChatController } from "./presentation/ai-chat.controller";
import { AiMoodController } from "./presentation/ai-mood.controller";
import { AiSessionController } from "./presentation/ai-session.controller";
import { AiGhostController } from "./presentation/ai-ghost.controller";
import { AiVisionController } from "./presentation/ai-vision.controller";
import { AiWeeklyReviewController } from "./presentation/ai-weekly-review.controller";
import { AiMockExamPhotoController } from "./presentation/ai-mock-exam-photo.controller";
import { AiPhotoController } from "./presentation/ai-photo.controller";
import { AdminEmbeddingController } from "./presentation/admin-embedding.controller";

/**
 * W3 — AI bounded context: coach chat, RAG, photo→subject categorize (premium vision).
 */
@Module({
  imports: [IdentityModule, ContentModule, PaymentsModule, EconomyModule, CoachingModule],
  controllers: [
    AiChatController,
    AiMoodController,
    AiSessionController,
    AiGhostController,
    AiVisionController,
    AiWeeklyReviewController,
    AiPhotoController,
    AiMockExamPhotoController,
    AdminEmbeddingController,
  ],
  providers: [
    ChatService,
    CoachAccessService,
    MoodReflectionService,
    DailyGreetingService,
    PlanDraftService,
    SessionReflectionService,
    GhostNarrationService,
    VisionNoteService,
    WeeklyReviewNarrationService,
    PhotoAccessService,
    PhotoCategorizeService,
    PhotoUploadService,
    ContextBuilder,
    AiUsageRepository,
    AiCostStatsService,
    AiBudgetGuard,
    AiErasureService,
    CoachFeedbackStatsService,
    CoachMessageRepository,
    CoachConversationRepository,
    CoachMemoryRepository,
    WeeklyReviewCacheRepository,
    DailyGreetingRepository,
    EmbeddingService,
    ArticleEmbeddingListener,
    AiJobRegistrar,
    EmbedArticleHandler,
    RefreshMemoryHandler,
    FakeLlmAdapter,
    OpenAiLlmAdapter,
    GeminiLlmAdapter,
    OpenAiVisionAdapter,
    FakeVisionAdapter,
    GeminiVisionAdapter,
    {
      provide: LLM_PORT,
      inject: [ConfigService, FakeLlmAdapter, OpenAiLlmAdapter, GeminiLlmAdapter],
      useFactory: (
        config: ConfigService<Env, true>,
        fake: FakeLlmAdapter,
        openai: OpenAiLlmAdapter,
        gemini: GeminiLlmAdapter,
      ) => {
        switch (config.get("AI_PROVIDER", { infer: true })) {
          case "openai":
            return openai;
          case "gemini":
            return gemini;
          default:
            return fake;
        }
      },
    },
    {
      provide: VISION_PORT,
      inject: [ConfigService, FakeVisionAdapter, GeminiVisionAdapter, OpenAiVisionAdapter],
      useFactory: (
        config: ConfigService<Env, true>,
        fake: FakeVisionAdapter,
        gemini: GeminiVisionAdapter,
        openai: OpenAiVisionAdapter,
      ) => {
        switch (config.get("VISION_PROVIDER", { infer: true })) {
          case "gemini":
            return gemini;
          case "openai":
            return openai;
          default:
            return fake;
        }
      },
    },
  ],
  exports: [AiCostStatsService, CoachFeedbackStatsService, AiErasureService],
})
export class AiModule {}



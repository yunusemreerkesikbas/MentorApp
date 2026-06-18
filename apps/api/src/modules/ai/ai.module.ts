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
import { PhotoAccessService } from "./application/photo-access.service";
import { PhotoCategorizeService } from "./application/photo-categorize.service";
import { PhotoUploadService } from "./application/photo-upload.service";
import { ContextBuilder } from "./application/context-builder.service";
import { EmbeddingService } from "./application/embedding.service";
import { ArticleEmbeddingListener } from "./application/article-embedding.listener";
import { AiJobRegistrar } from "./application/ai-job.registrar";
import { EmbedArticleHandler } from "./application/handlers/embed-article.handler";
import { AiUsageRepository } from "./infrastructure/ai-usage.repository";
import { FakeLlmAdapter } from "./infrastructure/adapters/fake-llm.adapter";
import { OpenAiLlmAdapter } from "./infrastructure/adapters/openai-llm.adapter";
import { FakeVisionAdapter } from "./infrastructure/adapters/fake-vision.adapter";
import { GeminiVisionAdapter } from "./infrastructure/adapters/gemini-vision.adapter";
import { AiChatController } from "./presentation/ai-chat.controller";
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
    AiPhotoController,
    AiMockExamPhotoController,
    AdminEmbeddingController,
  ],
  providers: [
    ChatService,
    CoachAccessService,
    PhotoAccessService,
    PhotoCategorizeService,
    PhotoUploadService,
    ContextBuilder,
    AiUsageRepository,
    EmbeddingService,
    ArticleEmbeddingListener,
    AiJobRegistrar,
    EmbedArticleHandler,
    FakeLlmAdapter,
    OpenAiLlmAdapter,
    FakeVisionAdapter,
    GeminiVisionAdapter,
    {
      provide: LLM_PORT,
      inject: [ConfigService, FakeLlmAdapter, OpenAiLlmAdapter],
      useFactory: (config: ConfigService<Env, true>, fake: FakeLlmAdapter, openai: OpenAiLlmAdapter) =>
        config.get("AI_PROVIDER", { infer: true }) === "openai" ? openai : fake,
    },
    {
      provide: VISION_PORT,
      inject: [ConfigService, FakeVisionAdapter, GeminiVisionAdapter],
      useFactory: (
        config: ConfigService<Env, true>,
        fake: FakeVisionAdapter,
        gemini: GeminiVisionAdapter,
      ) => (config.get("VISION_PROVIDER", { infer: true }) === "gemini" ? gemini : fake),
    },
  ],
})
export class AiModule {}

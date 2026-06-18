import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { ContentModule } from "../content/content.module";
import { EconomyModule } from "../economy/economy.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { LLM_PORT } from "./domain/llm.port";
import { ChatService } from "./application/chat.service";
import { CoachAccessService } from "./application/coach-access.service";
import { ContextBuilder } from "./application/context-builder.service";
import { EmbeddingService } from "./application/embedding.service";
import { ArticleEmbeddingListener } from "./application/article-embedding.listener";
import { AiJobRegistrar } from "./application/ai-job.registrar";
import { EmbedArticleHandler } from "./application/handlers/embed-article.handler";
import { AiUsageRepository } from "./infrastructure/ai-usage.repository";
import { FakeLlmAdapter } from "./infrastructure/adapters/fake-llm.adapter";
import { OpenAiLlmAdapter } from "./infrastructure/adapters/openai-llm.adapter";
import { AiChatController } from "./presentation/ai-chat.controller";
import { AdminEmbeddingController } from "./presentation/admin-embedding.controller";

/**
 * W3 — AI bounded context. Slice 1: premium AI coach chat (single-turn, refusal-grounded). LLM
 * behind LlmPort (fake = dev/test default; openai = production, env-gated). Consumes IdentityModule
 * (profile) + ContentModule (countdown) + PaymentsModule (entitlement) + EconomyModule (coin spend).
 * RAG + web gate + earned coin → AI chat (premium flat vs coin path in ChatService).
 */
@Module({
  imports: [IdentityModule, ContentModule, PaymentsModule, EconomyModule],
  controllers: [AiChatController, AdminEmbeddingController],
  providers: [
    ChatService,
    CoachAccessService,
    ContextBuilder,
    AiUsageRepository,
    EmbeddingService,
    ArticleEmbeddingListener,
    AiJobRegistrar,
    EmbedArticleHandler,
    FakeLlmAdapter,
    OpenAiLlmAdapter,
    {
      provide: LLM_PORT,
      inject: [ConfigService, FakeLlmAdapter, OpenAiLlmAdapter],
      useFactory: (config: ConfigService<Env, true>, fake: FakeLlmAdapter, openai: OpenAiLlmAdapter) =>
        config.get("AI_PROVIDER", { infer: true }) === "openai" ? openai : fake,
    },
  ],
})
export class AiModule {}

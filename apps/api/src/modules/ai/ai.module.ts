import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { ContentModule } from "../content/content.module";
import { IdentityModule } from "../identity/identity.module";
import { PaymentsModule } from "../payments/payments.module";
import { LLM_PORT } from "./domain/llm.port";
import { ChatService } from "./application/chat.service";
import { ContextBuilder } from "./application/context-builder.service";
import { AiUsageRepository } from "./infrastructure/ai-usage.repository";
import { FakeLlmAdapter } from "./infrastructure/adapters/fake-llm.adapter";
import { OpenAiLlmAdapter } from "./infrastructure/adapters/openai-llm.adapter";
import { AiChatController } from "./presentation/ai-chat.controller";

/**
 * W3 — AI bounded context. Slice 1: premium AI coach chat (single-turn, refusal-grounded). LLM
 * behind LlmPort (fake = dev/test default; openai = production, env-gated). Consumes IdentityModule
 * (profile) + ContentModule (countdown) public services and PaymentsModule (PremiumGuard).
 * RAG/web-UI/coin-spend = later slices.
 */
@Module({
  imports: [IdentityModule, ContentModule, PaymentsModule],
  controllers: [AiChatController],
  providers: [
    ChatService,
    ContextBuilder,
    AiUsageRepository,
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

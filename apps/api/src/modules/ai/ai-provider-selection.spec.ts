import { MODULE_METADATA } from "@nestjs/common/constants";
import type { FactoryProvider, Provider, Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiModule } from "./ai.module";
import { RAW_LLM_PORT, type LlmPort } from "./domain/llm.port";
import { RAW_VISION_PORT, type VisionPort } from "./domain/vision.port";
import { FakeLlmAdapter } from "./infrastructure/adapters/fake-llm.adapter";
import { FakeVisionAdapter } from "./infrastructure/adapters/fake-vision.adapter";
import { OpenAiLlmAdapter } from "./infrastructure/adapters/openai-llm.adapter";
import { OpenAiVisionAdapter } from "./infrastructure/adapters/openai-vision.adapter";
import { GeminiLlmAdapter } from "./infrastructure/adapters/gemini-llm.adapter";
import { GeminiVisionAdapter } from "./infrastructure/adapters/gemini-vision.adapter";

const definitions = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AiModule) as Provider[];
const factories = definitions.filter((entry): entry is FactoryProvider =>
  typeof entry === "object" && "provide" in entry &&
  (entry.provide === RAW_LLM_PORT || entry.provide === RAW_VISION_PORT));
// Resolve the real module factories with only their adapter dependencies, without the DB/jobs.
const adapters = definitions.filter((entry): entry is Type<unknown> => typeof entry === "function" &&
  entry.name.endsWith("Adapter") && !["PrivacyPreservingLlmAdapter", "BudgetedVisionAdapter"].includes(entry.name));

async function create(provider: string) {
  return Test.createTestingModule({ providers: [...factories, ...adapters, {
    provide: ConfigService, useValue: { get: (key: string) =>
      key === "AI_PROVIDER" || key === "VISION_PROVIDER" ? provider : undefined },
  }] }).compile();
}

afterEach(() => vi.unstubAllGlobals());

describe("AI module provider selection", () => {
  it.each([
    ["fake", FakeLlmAdapter, FakeVisionAdapter],
    ["openai", OpenAiLlmAdapter, OpenAiVisionAdapter],
    ["gemini", GeminiLlmAdapter, GeminiVisionAdapter],
  ] as const)("preserves the %s adapters", async (provider, text, vision) => {
    const module = await create(provider);
    try {
      expect(module.get(RAW_LLM_PORT)).toBeInstanceOf(text);
      expect(module.get(RAW_VISION_PORT)).toBeInstanceOf(vision);
    } finally { await module.close(); }
  });

  it("denies every disabled operation without keys, fake responses or provider requests", async () => {
    const fetch = vi.fn(() => { throw new Error("Provider network must remain unused"); });
    vi.stubGlobal("fetch", fetch);
    const module = await create("disabled");
    try {
      const llm = module.get<LlmPort>(RAW_LLM_PORT);
      const vision = module.get<VisionPort>(RAW_VISION_PORT);
      const denial = { code: "AI_DISABLED", httpStatus: 404 };
      await expect(llm.complete({ system: "fixture", user: "fixture" })).rejects.toMatchObject(denial);
      await expect(llm.embed("editorial")).rejects.toMatchObject(denial);
      await expect(llm.completeStream({ system: "fixture", user: "fixture" })[Symbol.asyncIterator]().next())
        .rejects.toMatchObject(denial);
      await expect(vision.categorizeImage({ imageBytes: Buffer.from("fixture"), mimeType: "image/png",
        allowedSubjects: [], allowedTopics: [] })).rejects.toMatchObject(denial);
      expect(fetch).not.toHaveBeenCalled();
    } finally { await module.close(); }
  });
});

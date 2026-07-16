import { resolve } from "node:path";

import { ConfigService } from "@nestjs/config";
import { config as loadEnv } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";

import type { Env } from "../../src/config/env.validation";
import type { LlmStreamEvent } from "../../src/modules/ai/domain/llm.port";
import { OpenAiLlmAdapter } from "../../src/modules/ai/infrastructure/adapters/openai-llm.adapter";
import { OpenAiVisionAdapter } from "../../src/modules/ai/infrastructure/adapters/openai-vision.adapter";

// A synthetic 320×90 PNG containing only "2x + 4 = 10"; no user data.
const SYNTHETIC_MATH_QUESTION_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAUAAAABaCAYAAADJqo/jAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAT/SURBVHhe7dxhcuogFIZhl+eCXI57cSvuJJ12JjYcCBwwCSTf+8zwp/ZqTckbUHtvEwCIutkvAIAKAghAFgEEIIsAApBFAAHIIoAAZBFAALIIIABZBBCALAIIQBYBBCCLAAKQRQAByCKAAGQRQACyCCAAWQQQgCwCCEAWAQQgiwACkEUAAcgigABkEUAAsgggAFkEEIAsAghAFgEEIIsAApBFAAHIIoAAZA0QwNf0uN2mW2o8XvabUen1+D+eSofz87zvz+ltb3R5T897Yk7e7tOz7Q4xoI4BzITPjDszrs3rERxHmQAun3dDAN/PezQHo9FwvxhPnwC+n9PdTqjSkDl7txJfYCQOoZ1blaFyxe8zHpPCIb2yDgGMT8zkJDWrl9/BStBvufWdx+UDaOO3NrfWRHPObncT2+LLH9RrOzyA9gqbnz82llxxXaIT2XOsT27lOfsDaOKW+XfhHLaRxJkcHEAzyTxn5Alfx1quvo5ftdqLxrmOXYvUavczMiELBPOsFLWGeYwhHRtAs0XxzZvwhD4+KPV6BjCIweMRHDvf8T4Pu5v4G/fn9Fp+3RnA4Lh5/k0QTHYmZ9UxgKWr7Cy82oZBsa/JlO/TnjR7RKFbAKOTMrx47PFc+4lXuvOxDn7Hnphl59iKpos5RnNsAJsUJqd94Ts34e337jRr+wQwFbvU174Vh6dlfH9clj9HuAKrD2DLcSrMS5zC+AF0XGntqi49Ge1qcb9tS48Ahlvf+Zm1nNglIwUwveKvDuAGO5O9LqbY1/ABDF/gXotWOW42knvO18MDGG19PzdcOIDrqgO4evzy0hcdnMnYATTvAGdPmtz21tyWvZ8NHBvAXORyt11XlwB6HgfDGTeANmiOiZle5ZkVyyYTdZtV0PerhtI2jAB6ft/hvCnPs1nt42A8gwbQBqbxdRn7kQj3/ZTYn69xfFmk8olLAD1hKh/HtNrHwXgGDGAcl6oTN1o5/o/ttqPxz9g0qp6Y4XhzyP6c6e+5ntowEUBdYwUwEa+Wk9Zuhf9Gyx012v81wNLWd0YAXWHiNUBZ4wQw8bec7SesfVd4q62vz94B9K9Y9gjgNqvfPY7LrEsAtzm4ONgQAYxXbF8GKxFT14mwkV0D6Nr6zgig6/fO5wBldQ9g+Dm/mgm4Zv0E3fOkW9ozgPHFonF4wpC0fnxrxtbHZak6gE0XCv4S5Ao6BtBuU3+Hf/uxxn5w+rnLu8B51w7g+OoD2BCzqpU4RtUpgIn4uSZqQfK/zoo/GvP14xQQwL7qA9jwhkbj64YYS5cARtveTS6fZmu2vM9L/yVITsvW7vxaAsj/B6jp+ADaNyg2mjx262vvNby9NMGvggC6A2ijlphDM7sKVzmuV3RwAO0L6OuTrIrrb4bNY7tPjDMjgFW/Z3txji6UNpLbXcDRx7EBjCZYw4gmXEXYXKG8EgKYnQ8J0csz2bHRBRzdHBrAusm1MsxZXLu1rf3+cyOAtQH8Zbe46UH8ruDAACa2Dy1jeRY3regqVoynRwDbf79r8/XqF00tBwYQAMZCAAHIIoAAZBFAALIIIABZBBCALAIIQBYBBCCLAAKQRQAByCKAAGQRQACyCCAAWQQQgCwCCEAWAQQgiwACkEUAAcgigABkEUAAsgggAFkEEIAsAghAFgEEIIsAApBFAAHIIoAAZBFAALIIIABZBBCALAIIQBYBBCDrB6B8spG/riVLAAAAAElFTkSuQmCC";

loadEnv({ path: resolve(process.cwd(), ".env") });

let llm: OpenAiLlmAdapter;
let vision: OpenAiVisionAdapter;

beforeAll(() => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("...")) {
    throw new Error("OPENAI_API_KEY must be configured in apps/api/.env for live tests.");
  }
  const providerConfig = new ConfigService<Env, true>({
    OPENAI_API_KEY: apiKey,
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    OPENAI_EMBED_MODEL: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
  });
  llm = new OpenAiLlmAdapter(providerConfig);
  vision = new OpenAiVisionAdapter(providerConfig);
});

describe("OpenAI live contract", () => {
  it("returns a non-empty blocking completion", async () => {
    const result = await llm.complete({
      system: "Yalnızca kısa bir Türkçe onay yaz.",
      user: "Bağlantıyı doğrula.",
    });

    expect(result.text.trim()).not.toBe("");
    expect(result.model).not.toBe("");
  });

  it("streams deltas and a matching final response", async () => {
    const events: LlmStreamEvent[] = [];
    for await (const event of llm.completeStream({
      system: "Yalnızca kısa bir Türkçe onay yaz.",
      user: "Akışı doğrula.",
    })) {
      events.push(event);
    }

    const deltas = events.flatMap((event) => (event.delta ? [event.delta] : []));
    const finals = events.flatMap((event) => (event.final ? [event.final] : []));
    expect(deltas.length).toBeGreaterThan(0);
    expect(finals).toHaveLength(1);
    expect(finals[0]?.text).toBe(deltas.join("").trim());
  });

  it("returns the pgvector-compatible embedding contract", async () => {
    const embedding = await llm.embed("KPSS çalışma planı");

    expect(embedding).toHaveLength(1536);
    expect(embedding.every(Number.isFinite)).toBe(true);
  });

  it("classifies a synthetic question within the supplied taxonomy", async () => {
    const result = await vision.categorizeImage({
      imageBytes: Buffer.from(SYNTHETIC_MATH_QUESTION_PNG, "base64"),
      mimeType: "image/png",
      allowedSubjects: [{ slug: "matematik", name: "Matematik" }],
      allowedTopics: [
        {
          subjectSlug: "matematik",
          slug: "cebirsel-islemler-ve-denklemler",
          name: "Cebirsel işlemler ve denklemler",
        },
      ],
    });

    expect(result.subjectSlug).toBe("matematik");
    expect(result.topicSlug).toBe("cebirsel-islemler-ve-denklemler");
  });
});

import { HttpStatus, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Env } from "../../../../config/env.validation";
import { ErrorCode } from "../../../../common/errors/error-code";
import type { LlmStreamEvent } from "../../domain/llm.port";
import { OpenAiLlmAdapter } from "./openai-llm.adapter";
import { OpenAiVisionAdapter } from "./openai-vision.adapter";

const MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMENSIONS = 1536;

function createConfig(): ConfigService<Env, true> {
  return new ConfigService<Env, true>({
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: MODEL,
    OPENAI_EMBED_MODEL: EMBED_MODEL,
  });
}

function jsonResponse(body: unknown, status = 200, requestId = "req-test"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
  });
}

async function collectEvents(iterable: AsyncIterable<LlmStreamEvent>): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe("OpenAI adapters", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("OpenAiLlmAdapter", () => {
    it("sends instructions + ordered input history (Responses API) and returns provider usage", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          id: "resp-test",
          object: "response",
          status: "completed",
          model: MODEL,
          output: [
            {
              type: "message",
              role: "assistant",
              content: [{ type: "output_text", text: "  Merhaba  " }],
            },
          ],
          usage: { input_tokens: 11, output_tokens: 4, total_tokens: 15 },
        }),
      );

      const result = await new OpenAiLlmAdapter(createConfig()).complete({
        system: "system",
        history: [
          { role: "user", content: "önceki soru" },
          { role: "assistant", content: "önceki yanıt" },
        ],
        user: "yeni soru",
      });

      const request = fetchMock.mock.calls[0]?.[1];
      const body = JSON.parse(String(request?.body)) as {
        model: string;
        instructions: string;
        input: { role: string; content: string }[];
        max_output_tokens: number;
        messages?: unknown;
        max_tokens?: unknown;
        stream?: boolean;
      };
      expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/responses");
      expect(body).toMatchObject({
        model: MODEL,
        instructions: "system",
        input: [
          { role: "user", content: "önceki soru" },
          { role: "assistant", content: "önceki yanıt" },
          { role: "user", content: "yeni soru" },
        ],
        max_output_tokens: 600,
      });
      // Chat-completions leftovers must be gone (system never duplicated into input).
      expect(body.messages).toBeUndefined();
      expect(body.max_tokens).toBeUndefined();
      expect(body.stream).toBeUndefined();
      expect(result).toEqual({
        text: "Merhaba",
        promptTokens: 11,
        completionTokens: 4,
        model: MODEL,
      });
    });

    it("maps an incomplete/failed response status to AI_PROVIDER_ERROR", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          status: "incomplete",
          output: [
            { type: "message", role: "assistant", content: [{ type: "output_text", text: "yarım" }] },
          ],
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
      );

      await expect(
        new OpenAiLlmAdapter(createConfig()).complete({ system: "system", user: "user" }),
      ).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_ERROR });
    });

    it("redacts provider error bodies and logs the request id", async () => {
      const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      fetchMock.mockResolvedValue(
        new Response("sensitive provider body", {
          status: 429,
          headers: { "x-request-id": "req-rate-limit" },
        }),
      );

      await expect(
        new OpenAiLlmAdapter(createConfig()).complete({ system: "system", user: "user" }),
      ).rejects.toMatchObject({
        code: ErrorCode.AI_PROVIDER_ERROR,
        httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
      });

      const logged = errorSpy.mock.calls.flat().join(" ");
      expect(logged).toContain("429");
      expect(logged).toContain("req-rate-limit");
      expect(logged).not.toContain("sensitive provider body");
    });

    it.each([
      ["network failure", () => Promise.reject(new Error("offline"))],
      ["empty output", () => Promise.resolve(jsonResponse({ status: "completed", output: [] }))],
    ])("maps %s to AI_PROVIDER_ERROR", async (_label, response) => {
      fetchMock.mockImplementation(response);

      await expect(
        new OpenAiLlmAdapter(createConfig()).complete({ system: "system", user: "user" }),
      ).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_ERROR });
    });

    it("does not log malformed completion content", async () => {
      const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      fetchMock.mockResolvedValue(new Response("{sensitive-completion-json"));

      await expect(
        new OpenAiLlmAdapter(createConfig()).complete({ system: "system", user: "user" }),
      ).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_ERROR });

      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("sensitive-completion-json");
    });

    it("parses fragmented typed SSE frames and emits one final event with usage", async () => {
      const encoder = new TextEncoder();
      const chunks = [
        'event: response.created\ndata: {"type":"response.created"}\n\n',
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Mer',
        'ha"}\n\nevent: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"ba"}\n\n',
        'event: response.output_text.done\ndata: {"type":"response.output_text.done","text":"Merhaba"}\n\n',
        'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":7,"output_tokens":2}}}\n\n',
      ];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      });
      fetchMock.mockResolvedValue(
        new Response(stream, { status: 200, headers: { "x-request-id": "req-stream" } }),
      );

      const events = await collectEvents(
        new OpenAiLlmAdapter(createConfig()).completeStream({
          system: "system",
          user: "user",
        }),
      );

      const request = fetchMock.mock.calls[0]?.[1];
      const body = JSON.parse(String(request?.body)) as { stream?: boolean; stream_options?: unknown };
      expect(body.stream).toBe(true);
      expect(body.stream_options).toBeUndefined(); // not a Responses param — usage rides response.completed
      expect(events).toEqual([
        { delta: "Merha" },
        { delta: "ba" },
        {
          final: {
            text: "Merhaba",
            promptTokens: 7,
            completionTokens: 2,
            model: MODEL,
          },
        },
      ]);
    });

    it("maps a response.failed stream event to AI_PROVIDER_ERROR", async () => {
      const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      fetchMock.mockResolvedValue(
        new Response(
          'event: response.failed\ndata: {"type":"response.failed","response":{"status":"failed"}}\n\n',
          { status: 200 },
        ),
      );

      await expect(
        collectEvents(
          new OpenAiLlmAdapter(createConfig()).completeStream({ system: "system", user: "user" }),
        ),
      ).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_ERROR });
      expect(errorSpy.mock.calls.flat().join(" ")).toContain("response.failed");
    });

    it.each([
      ["missing response body", new Response(null, { status: 200 })],
      ["malformed SSE", new Response('data: {"type":\n\n', { status: 200 })],
    ])("maps %s to AI_PROVIDER_ERROR", async (_label, response) => {
      fetchMock.mockResolvedValue(response);

      await expect(
        collectEvents(
          new OpenAiLlmAdapter(createConfig()).completeStream({
            system: "system",
            user: "user",
          }),
        ),
      ).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_ERROR });
    });

    it("returns a 1536-dimensional finite embedding", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: Array(EMBED_DIMENSIONS).fill(0.1) }],
          model: EMBED_MODEL,
          usage: { prompt_tokens: 2, total_tokens: 2 },
        }),
      );

      const vector = await new OpenAiLlmAdapter(createConfig()).embed("Türkçe paragraf");

      expect(vector).toHaveLength(EMBED_DIMENSIONS);
      expect(vector.every(Number.isFinite)).toBe(true);
    });

    it.each([
      ["wrong dimensions", [0.1]],
      ["non-finite values", [...Array(EMBED_DIMENSIONS - 1).fill(0.1), "invalid"]],
    ])("rejects embeddings with %s", async (_label, embedding) => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [{ embedding }] }));

      await expect(new OpenAiLlmAdapter(createConfig()).embed("text")).rejects.toMatchObject({
        code: ErrorCode.AI_PROVIDER_ERROR,
      });
    });
  });

  describe("OpenAiVisionAdapter", () => {
    it("sends the image as a Responses input_image + text.format json, returns provider usage", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          id: "resp-vision",
          object: "response",
          status: "completed",
          model: MODEL,
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                { type: "output_text", text: JSON.stringify({ subjectSlug: "matematik", topicSlug: "problemler" }) },
              ],
            },
          ],
          usage: { input_tokens: 20, output_tokens: 8, total_tokens: 28 },
        }),
      );

      const result = await new OpenAiVisionAdapter(createConfig()).categorizeImage({
        imageBytes: Buffer.from("synthetic-image"),
        mimeType: "image/png",
        allowedSubjects: [{ slug: "matematik", name: "Matematik" }],
        allowedTopics: [
          { subjectSlug: "matematik", slug: "problemler", name: "Problemler" },
        ],
      });

      expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/responses");
      const request = fetchMock.mock.calls[0]?.[1];
      const body = JSON.parse(String(request?.body)) as {
        instructions: string;
        input: { role: string; content: { type: string; text?: string; image_url?: string }[] }[];
        text: { format: { type: string } };
        max_output_tokens: number;
        messages?: unknown;
        response_format?: unknown;
        max_tokens?: unknown;
      };
      const userContent = body.input[0]?.content;
      expect(Array.isArray(userContent)).toBe(true);
      if (!Array.isArray(userContent)) throw new Error("Expected multimodal input content");
      expect(userContent[0]).toMatchObject({ type: "input_text" });
      expect(userContent[0]?.text).toContain('"slug":"matematik"');
      expect(userContent[0]?.text).toContain('"slug":"problemler"');
      expect(userContent[1]).toEqual({
        type: "input_image",
        image_url: `data:image/png;base64,${Buffer.from("synthetic-image").toString("base64")}`,
      });
      expect(body.text.format).toEqual({ type: "json_object" });
      expect(body.max_output_tokens).toBe(128);
      // No chat/completions leftovers.
      expect(body.messages).toBeUndefined();
      expect(body.response_format).toBeUndefined();
      expect(body.max_tokens).toBeUndefined();
      expect(result).toEqual({
        subjectSlug: "matematik",
        topicSlug: "problemler",
        model: MODEL,
        promptTokens: 20,
        completionTokens: 8,
      });
    });

    it("redacts provider error bodies and logs the request id", async () => {
      const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      fetchMock.mockResolvedValue(
        new Response("sensitive vision body", {
          status: 500,
          headers: { "x-request-id": "req-vision" },
        }),
      );

      await expect(
        new OpenAiVisionAdapter(createConfig()).categorizeImage({
          imageBytes: Buffer.from("image"),
          mimeType: "image/png",
          allowedSubjects: [],
          allowedTopics: [],
        }),
      ).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_ERROR });

      const logged = errorSpy.mock.calls.flat().join(" ");
      expect(logged).toContain("500");
      expect(logged).toContain("req-vision");
      expect(logged).not.toContain("sensitive vision body");
    });

    it("maps malformed provider JSON to AI_PROVIDER_ERROR", async () => {
      const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      fetchMock.mockResolvedValue(
        jsonResponse({
          status: "completed",
          output: [
            { type: "message", role: "assistant", content: [{ type: "output_text", text: "sensitive-vision-json" }] },
          ],
        }),
      );

      await expect(
        new OpenAiVisionAdapter(createConfig()).categorizeImage({
          imageBytes: Buffer.from("image"),
          mimeType: "image/png",
          allowedSubjects: [],
          allowedTopics: [],
        }),
      ).rejects.toMatchObject({ code: ErrorCode.AI_PROVIDER_ERROR });
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("sensitive-vision-json");
    });
  });
});

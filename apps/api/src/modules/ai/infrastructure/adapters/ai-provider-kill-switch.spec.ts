import { describe, expect, it, vi } from "vitest";
import { EmbedArticleHandler } from "../../application/handlers/embed-article.handler";
import type { LlmPort } from "../../domain/llm.port";
import { BudgetedVisionAdapter } from "./budgeted-vision.adapter";
import { PrivacyPreservingLlmAdapter } from "./privacy-preserving-llm.adapter";

const textInput = { system: "editorial", user: "question" };
const imageInput = { imageBytes: Buffer.from("fixture"), mimeType: "image/png", allowedSubjects: [], allowedTopics: [] };
const result = { text: "answer", model: "fixture", promptTokens: 1, completionTokens: 1 };
const operations = ["complete", "stream", "embed", "vision"] as const;
type Operation = typeof operations[number];

function setup(initiallyEnabled = false) {
  let enabled = initiallyEnabled;
  const config = { get: vi.fn(async () => enabled) };
  const budget = { acquire: vi.fn(async () => "reservation"), release: vi.fn(async () => undefined) };
  const delegate = {
    complete: vi.fn(async () => result),
    completeStream: vi.fn(async function* () { yield { delta: "answer" }; yield { final: result }; }),
    embed: vi.fn(async () => [1]),
  };
  const visionDelegate = { categorizeImage: vi.fn(async () => ({ ...result, subjectSlug: null, topicSlug: null })) };
  const text = new PrivacyPreservingLlmAdapter(delegate, budget as never, config as never);
  const vision = new BudgetedVisionAdapter(visionDelegate, budget as never, config as never);
  async function invoke(operation: Operation) {
    if (operation === "complete") return text.complete(textInput);
    if (operation === "embed") return text.embed("verified article");
    if (operation === "vision") return vision.categorizeImage(imageInput);
    const events = [];
    for await (const event of text.completeStream(textInput)) events.push(event);
    return events;
  }
  return { text, delegate, visionDelegate, budget, invoke, setEnabled: (value: boolean) => { enabled = value; } };
}

describe("global AI provider kill-switch", () => {
  it.each(operations)("blocks %s before any provider or reservation", async (operation) => {
    const fixture = setup();
    await expect(fixture.invoke(operation)).rejects.toMatchObject({ code: "AI_DISABLED", httpStatus: 404 });
    expect(fixture.delegate.complete).not.toHaveBeenCalled();
    expect(fixture.delegate.completeStream).not.toHaveBeenCalled();
    expect(fixture.delegate.embed).not.toHaveBeenCalled();
    expect(fixture.visionDelegate.categorizeImage).not.toHaveBeenCalled();
    expect(fixture.budget.acquire).not.toHaveBeenCalled();
    expect(fixture.budget.release).not.toHaveBeenCalled();
  });

  it.each(operations)("rechecks the flag for a later %s operation", async (operation) => {
    const fixture = setup(true);
    await fixture.invoke(operation);
    fixture.setEnabled(false);
    await expect(fixture.invoke(operation)).rejects.toMatchObject({ code: "AI_DISABLED" });
    const provider = operation === "vision" ? fixture.visionDelegate.categorizeImage
      : operation === "stream" ? fixture.delegate.completeStream : fixture.delegate[operation];
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("checks a lazy stream when consumed, even if created while AI was enabled", async () => {
    const fixture = setup(true);
    const stream = fixture.text.completeStream(textInput)[Symbol.asyncIterator]();
    fixture.setEnabled(false);
    await expect(stream.next()).rejects.toMatchObject({ code: "AI_DISABLED" });
    expect(fixture.delegate.completeStream).not.toHaveBeenCalled();
    expect(fixture.budget.acquire).not.toHaveBeenCalled();
  });

  it("blocks an already queued article embedding before provider and content writes", async () => {
    const fixture = setup();
    const content = {
      getArticleForEmbedding: vi.fn(async () => ({ title: "Title", body: "Verified content" })),
      setArticleEmbedding: vi.fn(),
    };
    const handler = new EmbedArticleHandler(fixture.text, content as never);
    await expect(handler.handle({ articleId: "123e4567-e89b-42d3-a456-426614174000" }))
      .rejects.toMatchObject({ code: "AI_DISABLED" });
    expect(fixture.delegate.embed).not.toHaveBeenCalled();
    expect(content.setArticleEmbedding).not.toHaveBeenCalled();
  });

  it("hands a successful stream reservation to its caller", async () => {
    const fixture = setup(true);
    await expect(fixture.invoke("stream")).resolves.toEqual([
      { delta: "answer" }, { final: { ...result, budgetReservationId: "reservation" } },
    ]);
    expect(fixture.budget.release).not.toHaveBeenCalled();
  });

  it("releases a stream reservation when the caller stops before the final event", async () => {
    const fixture = setup(true);
    for await (const event of fixture.text.completeStream(textInput)) {
      expect(event).toEqual({ delta: "answer" });
      break;
    }
    expect(fixture.budget.release).toHaveBeenCalledWith("reservation");
  });

  it("releases a stream reservation on provider failure", async () => {
    const budget = { acquire: vi.fn(async () => "reservation"), release: vi.fn() };
    const delegate: LlmPort = {
      complete: vi.fn(), embed: vi.fn(),
      async *completeStream() { yield { delta: "start" }; throw new Error("provider down"); },
    };
    const adapter = new PrivacyPreservingLlmAdapter(delegate, budget as never, { get: async () => true } as never);
    const stream = adapter.completeStream(textInput)[Symbol.asyncIterator]();
    await stream.next();
    await expect(stream.next()).rejects.toThrow("provider down");
    expect(budget.release).toHaveBeenCalledWith("reservation");
  });
});

import { describe, expect, it, vi } from "vitest";
import { ArticlePublished, ArticleUpdated } from "../../content/domain/content.events";
import { AI_EMBED_JOB } from "../domain/ai.constants";
import { ArticleEmbeddingListener } from "./article-embedding.listener";

describe("ArticleEmbeddingListener", () => {
  it.each([
    new ArticlePublished("article-1", "published", "KPSS"),
    new ArticleUpdated("article-2", "updated", "YKS"),
  ])("queues an embedding job for %s", async (event) => {
    const queue = { enqueue: vi.fn(async () => undefined) };
    const listener = new ArticleEmbeddingListener(queue as never);

    if (event instanceof ArticlePublished) await listener.onPublished(event);
    else await listener.onUpdated(event);

    expect(queue.enqueue).toHaveBeenCalledWith(AI_EMBED_JOB, {
      articleId: event.articleId,
    });
  });
});

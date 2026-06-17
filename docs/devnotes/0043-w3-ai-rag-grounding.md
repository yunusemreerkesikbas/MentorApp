# 0043 — W3 · AI Coach RAG Grounding (info_articles + pgvector)

> Date: 2026-06-17 · Scope: api (ai + content seam) + api-client regen + web koç UI · Related: roadmap §1,
> AGENTS §4 (#1/#3/#6), workstreams W3/W1. Builds on Slice 1 ([0030](./0030-w3-ai-coach-chat-slice1.md)).

## What was done
- The coach now **grounds content/process answers in verified `info_articles`** (pgvector retrieval) and
  cites sources — instead of Slice-1's blanket refusal. §4 #1 preserved: **dates/critical official info still
  defer to the data card** (no paraphrase); if no relevant article is found, the coach says so (no fabrication).
- **Embedding pipeline (async):** `ArticlePublished` → `ArticleEmbeddingListener` enqueues an `ai.embed-article`
  job (JobQueuePort) → `EmbedArticleHandler` calls `LlmPort.embed(title+body)` → stores via ContentService.
  **Backfill:** `POST /v1/admin/ai/reembed` (SUPER_ADMIN) enqueues embed jobs for published articles missing one.
- **LlmPort.embed** added: `FakeLlmAdapter` = deterministic lexical 1536-vector (token-hash buckets → testable
  similarity); `OpenAiLlmAdapter` = `/v1/embeddings` (`OPENAI_EMBED_MODEL`, default text-embedding-3-small;
  timeout + key-gated).
- **Content seam (W1, additive):** `InfoArticleRepository` `findById`/`setEmbedding`/
  `listPublishedWithoutEmbedding`/`searchSimilar` (pgvector `<=>` cosine, family-filtered); `ContentService`
  `getArticleForEmbedding`/`setArticleEmbedding`/`listPublishedNeedingEmbedding`/`searchSimilarArticles`.
  **Embedding column stays content-owned — AI computes the vector, content stores/searches it (§3).**
- **ChatService RAG:** embed the message → `searchSimilarArticles(examType, vec, top-K=3, ≤0.6 cosine)` →
  inject "KAYNAK MAKALELER" into the prompt + return `sources[]`. Embed failure → log + ungrounded (prompt
  forbids fabrication). Response is now `{ reply, model, sources: { title, slug, url }[] }`.
- **Web koç UI:** api-client regen → `coach.ts` `CoachReply.sources`; the coach bubble renders source chips
  (→ `/bilgi/{slug}`, token-styled). `ChatMessage.sources` carried in client state.

## How to use (usage)
```bash
# Backfill existing published articles (SUPER_ADMIN): POST /v1/admin/ai/reembed → { enqueued }
# New articles embed automatically on publish (ArticlePublished → job). Run jobs: cron process-jobs.
# Premium /koc: a content question now returns a grounded answer + source chips; dates → data card.
```

## Gotchas
- **§4 #1 (preserved):** prompt grounds ONLY on retrieved verified articles + cites them; critical
  dates/numbers still go to the data card (no paraphrase); **no relevant source → no fabrication** (≤0.6
  distance threshold + explicit "doğrulanmış içerik bulamadım → /bilgi" rule).
- **Content-owned embedding (§3):** AI never touches `info_articles`; it embeds + calls ContentService.
  Embedding is **content-only** (§4 #6 — no behavioral/PII data).
- **No migration:** the `embedding vector(1536)` column already exists (0006). **Vector index = backlog** —
  at MVP article counts a seq scan is exact + fast; add HNSW cosine at scale (db:generate can't express the
  vector op cleanly → hand-write then).
- **Async + retry:** embedding hits an external API → enqueued job (never blocks publish); handler idempotent
  (missing/unpublished article = no-op). Embeddings are **not** metered in `ai_usage` (only completions).
- **Fake embed is lexical** (token buckets): semantically rough but deterministic → RAG e2e is reliable
  without a real key. OpenAI embeddings are real in prod.
- **Family filter:** retrieval needs the user's `examType`; null examType → no retrieval (general coaching only).

## Related files & decisions
- `apps/api/src/modules/ai/{domain/llm.port.ts, domain/ai.constants.ts, application/chat.service.ts,
  application/embedding.service.ts, application/article-embedding.listener.ts, application/ai-job.registrar.ts,
  application/handlers/embed-article.handler.ts, infrastructure/adapters/*, presentation/admin-embedding.controller.ts, ai.module.ts}`
- `apps/api/src/modules/content/{application/content.service.ts, infrastructure/info-article.repository.ts}`
- `apps/web/src/lib/coach.ts` · `apps/web/src/app/(app)/koc/_components/{koc-shell,coach-transcript}.tsx`
- **Verified:** e2e `ai-rag` 3 (reembed super 201 / non-super 403; related question → article in `sources`;
  unrelated → no source) + `ai-coach` 5 still green; api lint+typecheck, web typecheck+build green.
- Decisions (owner): async embed job; admin backfill endpoint; sources[] + web chips; dates stay data-card / no fallback.

## Backlog
- HNSW/ivfflat vector index (at scale) · long-article chunking · re-embed on model change/versioning ·
  multi-turn + streaming · coin→AI spend · photo→categorize · Gemini embeddings.

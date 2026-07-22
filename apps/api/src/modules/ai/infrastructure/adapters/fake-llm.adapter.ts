import { Injectable } from "@nestjs/common";
import { PLAN_DRAFT_JSON_SENTINEL } from "../../domain/ai.constants";
import { PLAN_ADAPTATION_JSON_SENTINEL } from "../../domain/plan-adaptation";
import type {
  LlmCompleteInput,
  LlmPort,
  LlmResult,
  LlmStreamEvent,
} from "../../domain/llm.port";

/** Rough token estimate (~4 chars/token) — good enough for the usage meter in dev/test. */
const estimateTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / 4));

/**
 * Deterministic fake LLM (dev/test default — mirrors the fake payments adapter). Returns a fixed
 * coaching reply + estimated token counts so the usage meter and rate-limit are exercised without a
 * real provider/key. Never reaches production with a real key (AI_PROVIDER=openai there).
 */
@Injectable()
export class FakeLlmAdapter implements LlmPort {
  async complete(input: LlmCompleteInput): Promise<LlmResult> {
    if (input.system.includes(PLAN_ADAPTATION_JSON_SENTINEL)) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const hasTask = input.user.includes('"ref":"T1"');
      const text = JSON.stringify({
        changes: hasTask
          ? [
              { kind: "MOVE", taskRef: "T1", toDate: tomorrow },
              {
                kind: "ADD",
                title: "Kısa tekrar",
                subject: null,
                taskDate: later,
              },
            ]
          : [
              {
                kind: "ADD",
                title: "Matematik: 20 soru çöz",
                subject: "Matematik",
                taskDate: tomorrow,
              },
            ],
      });
      return {
        text,
        promptTokens: estimateTokens(input.system) + estimateTokens(input.user),
        completionTokens: estimateTokens(text),
        model: "fake",
      };
    }
    // Deterministic JSON draft for the plan-draft prompt (keyed on its JSON-only sentinel) so the
    // parse + clamp + bulk-confirm path is testable without a real provider.
    if (input.system.includes(PLAN_DRAFT_JSON_SENTINEL)) {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const text = JSON.stringify({
        days: [
          {
            date: today,
            tasks: [{ title: "Matematik: 20 soru çöz", subject: "Matematik" }],
          },
          {
            date: tomorrow,
            tasks: [
              { title: "Paragraf: 15 soru", subject: "Türkçe" },
              { title: "Tarih tekrar: 1 konu", subject: "Tarih" },
            ],
          },
        ],
      });
      return {
        text,
        promptTokens: estimateTokens(input.system) + estimateTokens(input.user),
        completionTokens: estimateTokens(text),
        model: "fake",
      };
    }
    // Deterministic multi-turn signal: history length is visible in the reply so specs and manual
    // dev verification can prove the history reached the LLM.
    const historyLine =
      input.history && input.history.length > 0
        ? ` (Önceki ${input.history.length} mesajını hatırlıyorum.)`
        : "";
    // Deterministic plan-revision signal: mentioning "plan"/"görev" yields a task marker so the
    // extract + stream-filter + FE card path is testable without a real provider.
    const taskMarker = /plan|görev/i.test(input.user)
      ? '\n<<TASK{"title":"Matematik: 20 soru çöz","subject":"Matematik"}>>'
      : "";
    // Deterministic follow-up signal: "nasıl" yields the FOLLOWUP marker (before TASK — order
    // contract) so the extract + stream-filter + FE chip path is testable without a real provider.
    const followUpMarker = /nasıl/i.test(input.user)
      ? '\n<<FOLLOWUP["Hangi konudan başlamalıyım?","Bana kısa bir çalışma planı önerir misin?"]>>'
      : "";
    const text =
      "Bugün küçük ve net bir hedefle başla: 25 dakikalık odak + 5 dakika mola. " +
      "Resmî tarih/süreç bilgileri için Bilgi Merkezi'ne bakmayı unutma." +
      historyLine +
      followUpMarker +
      taskMarker;
    const historyTokens = (input.history ?? []).reduce(
      (sum, m) => sum + estimateTokens(m.content),
      0,
    );
    return {
      text,
      promptTokens:
        estimateTokens(input.system) +
        historyTokens +
        estimateTokens(input.user),
      completionTokens: estimateTokens(text),
      model: "fake",
    };
  }

  /** Streams the deterministic reply word-by-word (small delay so the FE typing effect is visible in dev). */
  async *completeStream(
    input: LlmCompleteInput,
  ): AsyncIterable<LlmStreamEvent> {
    const result = await this.complete(input);
    const words = result.text.split(" ");
    for (let i = 0; i < words.length; i++) {
      yield { delta: i === 0 ? words[i]! : ` ${words[i]!}` };
      await new Promise((r) => setTimeout(r, 20));
    }
    yield { final: result };
  }

  /**
   * Deterministic lexical embedding: token-hash into 1536 buckets + L2-normalize. Not semantic, but
   * shared tokens → overlapping buckets → higher cosine similarity, so RAG retrieval is testable in
   * dev/test without a real embeddings API.
   */
  async embed(text: string): Promise<number[]> {
    const v = new Array<number>(1536).fill(0);
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9çğıöşü]+/i)
      .filter(Boolean);
    for (const t of tokens) {
      let h = 0;
      for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
      const idx = h % 1536;
      v[idx] = (v[idx] ?? 0) + 1;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  }
}

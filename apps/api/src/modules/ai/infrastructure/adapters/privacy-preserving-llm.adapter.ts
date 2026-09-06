import { Inject, Injectable } from "@nestjs/common";
import type {
  LlmCompleteInput,
  LlmPort,
  LlmResult,
  LlmStreamEvent,
} from "../../domain/llm.port";
import { RAW_LLM_PORT } from "../../domain/llm.port";
import { AiBudgetGuard } from "../../application/ai-budget.guard";

const URL = /https?:\/\/[^\s<>"']+/giu;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const IBAN = /\bTR\d{2}(?:[\s-]?\d){22}\b/giu;
const LONG_PAYMENT_NUMBER = /\b(?:\d[\s-]?){13,19}\b/gu;
const TURKISH_MOBILE = /\b(?:\+?90[\s.-]?)?(?:0?5\d{2})[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/gu;
const NATIONAL_ID = /\b\d{11}\b/gu;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/gu;
const USERNAME = /(^|\s)@[A-Z0-9_.-]{2,}/giu;
const DECLARED_NAME = /\b(?:benim\s+)?(?:adım|adim|ismim)\s+[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,2}/giu;
const DECLARED_ADDRESS = /\b(?:adresim|adresim şu|adresim su)\s*:?\s*[^\n.!?]{4,160}/giu;

/**
 * Removes common direct identifiers before user-authored text crosses the provider boundary.
 * The original message remains in the user's RLS-protected local conversation; only the outbound
 * copy is changed. This is intentionally deterministic and does not call another AI system.
 */
export function minimizeUserPrompt(value: string): string {
  return value
    .replace(URL, "[bağlantı]")
    .replace(EMAIL, "[e-posta]")
    .replace(IBAN, "[IBAN]")
    .replace(LONG_PAYMENT_NUMBER, "[kart]")
    .replace(TURKISH_MOBILE, "[telefon]")
    .replace(NATIONAL_ID, "[kimlik]")
    .replace(IPV4, "[IP]")
    .replace(USERNAME, "$1[kullanıcı]")
    .replace(DECLARED_NAME, "[ad]")
    .replace(DECLARED_ADDRESS, "[adres]");
}

function minimizeInput(input: LlmCompleteInput): LlmCompleteInput {
  return {
    // System content is constructed server-side and may contain verified source links.
    system: input.system,
    user: minimizeUserPrompt(input.user),
    ...(input.history
      ? {
          history: input.history.map((message) => ({
            ...message,
            content: minimizeUserPrompt(message.content),
          })),
        }
      : {}),
  };
}

/** Enforces data minimization for every text provider selected by AiModule. */
@Injectable()
export class PrivacyPreservingLlmAdapter implements LlmPort {
  constructor(
    @Inject(RAW_LLM_PORT) private readonly delegate: LlmPort,
    private readonly budget: AiBudgetGuard,
  ) {}

  async complete(input: LlmCompleteInput): Promise<LlmResult> {
    const budgetReservationId = await this.budget.acquire();
    try {
      const result = await this.delegate.complete(minimizeInput(input));
      return {
        ...result,
        ...(budgetReservationId ? { budgetReservationId } : {}),
      };
    } catch (error) {
      await this.budget.release(budgetReservationId);
      throw error;
    }
  }

  async *completeStream(input: LlmCompleteInput): AsyncIterable<LlmStreamEvent> {
    const budgetReservationId = await this.budget.acquire();
    let handedOff = false;
    try {
      for await (const event of this.delegate.completeStream(minimizeInput(input))) {
        if (event.final) {
          handedOff = true;
          yield {
            final: {
              ...event.final,
              ...(budgetReservationId ? { budgetReservationId } : {}),
            },
          };
        } else {
          yield event;
        }
      }
    } finally {
      if (!handedOff) await this.budget.release(budgetReservationId);
    }
  }

  embed(text: string): Promise<number[]> {
    // Embeddings are restricted to verified editorial content by the caller.
    return this.delegate.embed(text);
  }
}

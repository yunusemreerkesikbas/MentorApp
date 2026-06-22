import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Currency } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { ForumEventTopic, type AnswerAccepted } from "../../forum/domain/forum.events";
import { EconomyService } from "./economy.service";

/**
 * Bridges forum → economy: when a forum answer is accepted, grant the answerer XP. Idempotent on
 * the post id (ledger no-ops a duplicate), self-guards on `economy.enabled`. Consumes the forum
 * event only (no runtime dep on the forum module) — same pattern as quest-events ← payments.
 */
@Injectable()
export class ForumEventsListener {
  private readonly logger = new Logger(ForumEventsListener.name);

  constructor(
    private readonly economy: EconomyService,
    private readonly config: ConfigRegistryService,
  ) {}

  @OnEvent(ForumEventTopic.ANSWER_ACCEPTED)
  async onAnswerAccepted(event: AnswerAccepted): Promise<void> {
    // Swallow + log: this runs inside the accept's awaited emitAsync, so a throw here would 500 an
    // already-committed accept. The XP grant is best-effort (idempotent on postId → safe to retry).
    try {
      if (!(await this.config.get("economy.enabled"))) return;
      const amount = await this.config.get("forum.xp.accepted_answer");
      if (amount <= 0) return;
      await this.economy.grant(event.answerAuthorId, Currency.XP, amount, {
        reason: "forum.answer.accepted",
        refType: "forum.answer.accepted",
        refId: event.postId,
      });
    } catch (err) {
      this.logger.error(`XP grant failed for accepted answer ${event.postId}`, err as Error);
    }
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Currency } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { ForumEventTopic, type ThreadPosted } from "../../forum/domain/forum.events";
import { LedgerRepository } from "../infrastructure/ledger.repository";
import { EconomyService } from "./economy.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const REASON = "forum.thread.posted";

/**
 * Bridges forum → economy: posting a thread/message grants a little XP (feeds the effort
 * leaderboard). XP is generous by design (§3) — only capped per day to blunt chat-spam farming.
 * Idempotent on the thread id; self-guards on `economy.enabled`. Consumes the forum event only.
 */
@Injectable()
export class ThreadPostedListener {
  private readonly logger = new Logger(ThreadPostedListener.name);

  constructor(
    private readonly economy: EconomyService,
    private readonly ledger: LedgerRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  @OnEvent(ForumEventTopic.THREAD_POSTED)
  async onThreadPosted(event: ThreadPosted): Promise<void> {
    // Best-effort + logged: THREAD_POSTED is a fire-and-forget emit, so a throw here can't break the
    // post. Grant is idempotent on threadId → safe.
    try {
      if (!(await this.config.get("economy.enabled"))) return;
      const amount = await this.config.get("forum.xp.thread_posted");
      if (amount <= 0) return;

      const cap = await this.config.get("forum.xp.thread_posted_daily_cap");
      // ponytail: non-atomic cap — fine for cheap/generous XP; only coin needs the TOCTOU-safe path.
      const earnedToday = await this.ledger.grantCountSince(
        event.authorId,
        REASON,
        new Date(Date.now() - DAY_MS),
      );
      if (earnedToday >= cap) return;

      await this.economy.grant(event.authorId, Currency.XP, amount, {
        reason: REASON,
        refType: REASON,
        refId: event.threadId,
      });
    } catch (err) {
      this.logger.error(`XP grant failed for thread ${event.threadId}`, err as Error);
    }
  }
}

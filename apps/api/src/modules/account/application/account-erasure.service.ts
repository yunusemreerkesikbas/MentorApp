import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotFoundError } from "../../../common/errors/domain-error";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { AiErasureService } from "../../ai/application/ai-erasure.service";
import { AdsErasureService } from "../../ads/application/ads-erasure.service";
import { CoachingErasureService } from "../../coaching/application/coaching-erasure.service";
import { ForumErasureService } from "../../forum/application/forum-erasure.service";
import { SocialErasureService } from "../../identity/application/social-erasure.service";
import { TokenService } from "../../identity/application/token.service";
import { UsersService } from "../../identity/application/users.service";
import { NotificationsErasureService } from "../../notifications/application/notifications-erasure.service";
import { SubscriptionsService } from "../../payments/application/subscriptions.service";

export interface AccountErasureResult {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/**
 * KVKK erasure orchestration — the single path used by BOTH self-service ("hesabımı sil",
 * status DELETED) and the admin anonymize action (status BANNED).
 *
 * Lives in its own thin module because it must see identity + ai + coaching + payments at once:
 * identity is foundational (everyone imports it), so putting the orchestration there would create a
 * cycle. Each module still erases its OWN tables (workstreams §2) — this only sequences them.
 *
 * Order matters: the subscription is cancelled FIRST so an erased account never keeps getting billed.
 * Steps 1-3 throw on failure (a half-done erasure must not be reported as success); the whole flow is
 * idempotent, so the caller can safely retry. Storage cleanup is best-effort — the DB scrub already
 * landed and a storage hiccup must not undo it.
 *
 * KEPT on purpose: payment/invoice records (iyzico e-arşiv — legal retention) and the append-only
 * economy ledger. Their FKs stay intact because the user row is anonymized, not deleted.
 */
@Injectable()
export class AccountErasureService {
  private readonly logger = new Logger(AccountErasureService.name);

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly subscriptions: SubscriptionsService,
    private readonly aiErasure: AiErasureService,
    private readonly adsErasure: AdsErasureService,
    private readonly coachingErasure: CoachingErasureService,
    private readonly forumErasure: ForumErasureService,
    private readonly socialErasure: SocialErasureService,
    private readonly notificationsErasure: NotificationsErasureService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async eraseAccount(userId: string, status: string): Promise<AccountErasureResult> {
    // 1. Stop the money first — an erased account must not keep renewing.
    await this.subscriptions.cancel(userId).catch((err: unknown) => {
      if (err instanceof NotFoundError) return; // no open subscription — nothing to cancel
      throw err;
    });

    // 2. Behavioral data, module by module (each owns its own tables).
    await this.aiErasure.eraseUserData(userId);
    await this.adsErasure.eraseUserData(userId);
    await this.coachingErasure.eraseUserData(userId);
    await this.forumErasure.eraseUserData(userId);
    await this.socialErasure.eraseUserData(userId);
    await this.notificationsErasure.eraseUserData(userId);

    // 3. Identity row (identity owns `users`) + kill every session.
    const change = await this.users.anonymizeAccount(userId, status);
    await this.tokens.revokeAllForUser(userId);

    // 4. Avatar object — best-effort; the DB no longer points at it.
    if (change.avatarStorageKey) {
      await this.storage.deleteObject(change.avatarStorageKey).catch((err: unknown) => {
        this.logger.warn(`Avatar object not deleted for user ${userId}: ${String(err)}`);
      });
    }

    this.logger.log(`Account erased for user ${userId} (status=${status})`);
    return { before: change.before, after: change.after };
  }
}

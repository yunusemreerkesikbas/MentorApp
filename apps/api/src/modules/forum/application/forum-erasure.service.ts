import { Inject, Injectable, Logger } from "@nestjs/common";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { ForumErasureRepository } from "../infrastructure/forum-erasure.repository";

/**
 * KVKK erasure for forum (WP-K) — mirrors CoachingErasureService: the DB scrub is atomic in the
 * repository; storage object deletion is best-effort afterwards (a storage hiccup must not undo
 * the committed scrub). Idempotent: a second run redacts already-redacted rows and deletes nothing.
 */
@Injectable()
export class ForumErasureService {
  private readonly logger = new Logger(ForumErasureService.name);

  constructor(
    private readonly repo: ForumErasureRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async eraseUserData(userId: string): Promise<void> {
    const { attachmentStorageKeys } = await this.repo.eraseUserData(userId);
    let failed = 0;
    for (const key of attachmentStorageKeys) {
      await this.storage.deleteObject(key).catch(() => {
        failed += 1;
      });
    }
    if (failed > 0) {
      this.logger.warn(
        `Forum erasure: ${failed}/${attachmentStorageKeys.length} attachment objects could not be deleted for user ${userId}`,
      );
    }
    this.logger.log(`Forum data erased for user ${userId}`);
  }
}

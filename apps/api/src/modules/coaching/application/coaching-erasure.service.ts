import { Inject, Injectable, Logger } from "@nestjs/common";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { CoachingErasureRepository } from "../infrastructure/coaching-erasure.repository";
import { StudyRoomRepository } from "../infrastructure/study-room.repository";

/**
 * KVKK erasure for the coaching module (W2). Admin calls this via the user anonymize flow — coaching
 * owns its own tables (workstreams §2), so admin never writes them directly.
 *
 * The DB scrub is atomic (one tx); the user's uploaded images — question photos and vision-board
 * collage photos — are then deleted from storage best-effort (`Promise.allSettled`, same as the
 * mock-exam delete path), because a storage hiccup must not roll back an erasure that already
 * succeeded in the DB.
 * Idempotent: re-running on an already-erased user is a no-op.
 */
@Injectable()
export class CoachingErasureService {
  private readonly logger = new Logger(CoachingErasureService.name);

  constructor(
    private readonly repo: CoachingErasureRepository,
    private readonly rooms: StudyRoomRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async eraseUserData(userId: string): Promise<void> {
    const { photoStorageKeys } = await this.repo.eraseUserData(userId);

    // Room memberships are relational PII ("who studies with whom") — hard-deleted, like buddy
    // pairs. Owned rooms pass to the earliest remaining member so co-workers don't lose the table.
    await this.rooms.deleteAllForUser(userId);

    const results = await Promise.allSettled(
      photoStorageKeys.map((key) => this.storage.deleteObject(key)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      this.logger.warn(
        `Coaching erasure: ${failed}/${photoStorageKeys.length} image objects could not be deleted for user ${userId}`,
      );
    }
    this.logger.log(`Coaching data erased for user ${userId}`);
  }
}

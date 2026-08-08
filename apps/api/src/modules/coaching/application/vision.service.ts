import { Inject, Injectable, Logger } from "@nestjs/common";
import type { VisionBoardDoc, VisionDto } from "@mentor/types";
import type { UpsertVisionInput, VisionBoardDocInput } from "@mentor/validation";
import {
  NotFoundError,
  ValidationFailedError,
} from "../../../common/errors/domain-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import { GeoService } from "../../content/application/geo.service";
import { KpssService } from "../../content/application/kpss.service";
import { VisionBoardRepository } from "../infrastructure/vision-board.repository";
import { toVisionDto } from "./coaching.mappers";

/** Public prefix all board photos live under; the sweep lists exactly this. */
const VISION_BOARD_PREFIX = "vision-board/";
/** An object younger than this belongs to an editing session that has not saved yet. */
const VISION_BOARD_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
/** Fixed work per sweep pass; the next pass picks up whatever is left. */
const VISION_BOARD_ORPHAN_SWEEP_BATCH = 500;

/** Storage keys of every photo referenced by a board document. */
function imageKeysOf(board: VisionBoardDoc | null): Set<string> {
  if (!board) return new Set();
  return new Set(
    board.items.flatMap((item) => (item.kind === "image" ? [item.storageKey] : [])),
  );
}

/**
 * Vision/goal board ("hayal/hedef panosu") — one text-based goal anchor per user (upsert). Free tier
 * reads the goal; the premium AI motivation note (`aiNote`) is written by W3 via {@link setAiNote},
 * so the `vision_boards` table is only ever mutated inside coaching (workstreams §2).
 */
@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly visions: VisionBoardRepository,
    private readonly geo: GeoService,
    private readonly kpss: KpssService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async getMine(userId: string): Promise<VisionDto | null> {
    const dto = await withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.visions.findByUser(tx, userId);
      return row ? toVisionDto(row) : null;
    });
    return dto ? this.enrich(dto) : null;
  }

  /**
   * Everything the stored row cannot answer on its own: image URLs and the reference names behind
   * the goal's ids. Both derived per read and dropped by the write schema, so neither can go stale.
   *
   * The name lookups short-circuit on null ids, so a goal with no map selection costs no queries.
   */
  private async enrich(dto: VisionDto): Promise<VisionDto> {
    const targetNames = await this.resolveTargetNames(dto);
    return { ...this.withImageUrls(dto), targetNames };
  }

  /**
   * Resolve each board photo's storage key to a URL the browser can load.
   *
   * Done here rather than on the client because there is no base the client could hold: R2 hands
   * back an absolute CDN URL, the dev fake store an API-relative path. The field is derived on
   * every read and dropped by the write schema, so it never becomes stored state that can go stale.
   */
  private withImageUrls(dto: VisionDto): VisionDto {
    if (!dto.board) return dto;
    return {
      ...dto,
      board: {
        ...dto.board,
        items: dto.board.items.map((item) =>
          item.kind === "image"
            ? { ...item, url: this.storage.getPublicUrl(item.storageKey) }
            : item,
        ),
      },
    };
  }

  /**
   * The goal with its reference ids turned into names — what a prompt needs to name the target
   * instead of quoting a uuid.
   *
   * City follows the board's read rule: the map selection wins, and the legacy free-text field is
   * the fallback for goals written before the map existed (or ones the province list cannot
   * express). Missing that fallback is exactly how the AI note lost the city: the new UI only ever
   * writes `targetCityCode`, so anything reading `targetCity` alone now sees null.
   *
   * Called only on a cache miss — resolving names on every cached read would be two queries spent
   * on a string nobody looks at.
   */
  async resolveTargetNames(board: VisionDto): Promise<{
    cityName: string | null;
    universityName: string | null;
    titleName: string | null;
    institutionName: string | null;
  }> {
    const [geo, kpss] = await Promise.all([
      this.geo.resolveNames(board.targetCityCode, board.targetUniversityId),
      this.kpss.resolveNames(board.targetTitleId, board.targetInstitutionId),
    ]);
    return {
      cityName: geo.cityName ?? board.targetCity,
      universityName: geo.universityName,
      titleName: kpss.titleName,
      institutionName: kpss.institutionName,
    };
  }

  async upsert(userId: string, input: UpsertVisionInput): Promise<VisionDto> {
    const targetCityCode = input.targetCityCode ?? null;
    const targetUniversityId = input.targetUniversityId ?? null;
    const targetTitleId = input.targetTitleId ?? null;
    const targetInstitutionId = input.targetInstitutionId ?? null;

    // The schema already rejects a university without a city. What it cannot know is whether the
    // university actually sits in that city — the client picks both from the map, but a crafted
    // request could pair any university with any province, and the map would then draw the goal
    // in the wrong place forever.
    if (targetUniversityId && targetCityCode) {
      const belongs = await this.geo.universityExistsInCity(
        targetUniversityId,
        targetCityCode,
      );
      if (!belongs) {
        throw new ValidationFailedError({ reason: "university_city_mismatch" });
      }
    }

    // KPSS targets carry no city relationship to cross-check — an institution is national, and a
    // round's postings are not a claim about where it operates. Existence is what matters: a
    // dangling id would only surface later, as a goal the UI cannot name.
    if (targetTitleId || targetInstitutionId) {
      const exist = await this.kpss.assertTargetsExist(
        targetTitleId,
        targetInstitutionId,
      );
      if (!exist) {
        throw new ValidationFailedError({ reason: "unknown_kpss_target" });
      }
    }

    const normalized = {
      goalTitle: input.goalTitle.trim(),
      targetCityCode,
      targetCity: input.targetCity?.trim() ? input.targetCity.trim() : null,
      targetUniversityId,
      targetTitleId,
      targetInstitutionId,
      careerGroup: input.careerGroup ?? null,
      motivation: input.motivation?.trim() ? input.motivation.trim() : null,
    };
    const dto = await withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.visions.upsert(tx, userId, normalized);
      return toVisionDto(row);
    });
    return this.enrich(dto);
  }

  /**
   * Replace the collage document (`/hedef/pano`). Deliberately separate from {@link upsert}: the
   * goal upsert clears the cached premium AI note whenever the goal changes, and rearranging a
   * board is not a change of goal. Routing both through one endpoint is how that note would end up
   * regenerated — at LLM cost — every time somebody nudged a sticker.
   *
   * Requires an existing goal. A board without one has nothing to be about, and creating a goal as
   * a side effect of saving a layout would invent a `goalTitle` the user never typed.
   */
  async putBoard(userId: string, board: VisionBoardDocInput): Promise<VisionDto> {
    // The schema proves the key is well-formed; only the request knows whose it should be. Without
    // this, a crafted document could point at another user's object and publish it as its own.
    const foreign = board.items.find(
      (item) =>
        item.kind === "image" && !item.storageKey.startsWith(`vision-board/${userId}/`),
    );
    if (foreign) {
      throw new ValidationFailedError({ reason: "foreign_storage_key" });
    }

    const { dto, removedKeys } = await withUserContext(
      this.db,
      { userId },
      async (tx) => {
        const before = await this.visions.findByUser(tx, userId);
        if (!before) throw new NotFoundError({ reason: "vision_goal_missing" });
        // Snapshot the old keys as a plain Set before writing. Reading `before.board` afterwards
        // would work only as long as the repository hands back a detached row — a coupling the
        // orphan cleanup should not silently depend on.
        const previousKeys = imageKeysOf(before.board as VisionBoardDoc | null);

        const row = await this.visions.updateBoard(tx, userId, board);
        if (!row) throw new NotFoundError({ reason: "vision_goal_missing" });

        const kept = imageKeysOf(board as VisionBoardDoc);
        const removed = [...previousKeys].filter((key) => !kept.has(key));
        return { dto: toVisionDto(row), removedKeys: removed };
      },
    );

    // Outside the tx, best-effort: a photo the user dropped from the board must not keep living at
    // a public R2 URL (KVKK), but a storage hiccup must not roll back a save that already landed.
    if (removedKeys.length > 0) {
      const results = await Promise.allSettled(
        removedKeys.map((key) => this.storage.deleteObject(key)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        this.logger.warn(
          `Vision board: ${failed}/${removedKeys.length} removed image objects could not be deleted for user ${userId}`,
        );
      }
    }
    return this.enrich(dto);
  }

  /**
   * Delete board photos that no saved board references.
   *
   * `putBoard` already cleans up images removed from a board, but it cannot see the other leak:
   * a user who uploads photos in the editor and closes the tab without ever saving. Those objects
   * are referenced by nothing, so nothing will ever find them again — and they are personal data
   * sitting at a public URL (KVKK), which is the real reason this exists. Storage cost is noise.
   *
   * Bounded per run and grace-windowed: an object uploaded seconds ago belongs to an editing
   * session in progress, and deleting it would break a save that is still being composed.
   */
  async cleanupOrphanImages(): Promise<{ deleted: number }> {
    const candidates = await this.storage.listObjects(
      VISION_BOARD_PREFIX,
      VISION_BOARD_ORPHAN_SWEEP_BATCH,
    );
    if (candidates.length === 0) return { deleted: 0 };

    const cutoff = Date.now() - VISION_BOARD_ORPHAN_GRACE_MS;
    const referenced = new Set(
      await withServiceContext(this.db, (tx) => this.visions.listAllReferencedImageKeys(tx)),
    );

    const orphans = candidates.filter(
      (object) =>
        !referenced.has(object.key) &&
        // Unknown age is treated as "too young": never delete on missing metadata.
        object.lastModified != null &&
        object.lastModified.getTime() < cutoff,
    );

    for (const orphan of orphans) {
      await this.storage.deleteObject(orphan.key); // best-effort; a missing object is a no-op
    }
    return { deleted: orphans.length };
  }

  /** Cache the premium AI motivation note (public surface for W3 — coaching owns the table). */
  async setAiNote(
    userId: string,
    note: string,
    model: string,
    locale: string,
  ): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.visions.setAiNote(tx, userId, note, model, locale);
    });
  }

  async getAiNoteLocale(userId: string): Promise<string | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.visions.findByUser(tx, userId);
      return row?.aiLocale ?? null;
    });
  }
}
